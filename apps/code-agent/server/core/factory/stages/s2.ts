import type { StageContext, StageResult } from "../types.ts"
import { walkFiles } from "../files.ts"
import { analyzeRepo } from "../ast.ts"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"

const AiRuleSchema = z.object({
  summary: z.string().min(1),
  kind: z.enum(["threshold", "branch", "state", "sql", "other"]).default("other"),
  line: z.number().int().positive(),
  confidence: z.number().min(0).max(1).default(0.7),
})

function parseRuleLines(raw: string): unknown[] {
  const out: unknown[] = []
  for (const line of raw.replace(/```/g, "").split(/\r?\n/)) {
    const match = line.match(/\{.*\}/)
    if (!match) continue
    try {
      out.push(JSON.parse(match[0]) as unknown)
    } catch {
      // skip malformed line
    }
  }
  return out
}

function parseRules(raw: string): unknown[] {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").replace(/<\/?think>/g, "").trim()
  try {
    const whole = JSON.parse(cleaned) as unknown
    if (Array.isArray(whole)) return whole
    if (whole && typeof whole === "object" && Array.isArray((whole as { rules?: unknown[] }).rules)) return (whole as { rules: unknown[] }).rules
  } catch {
    // fall through to line scan
  }
  for (let start = cleaned.indexOf("["); start >= 0; start = cleaned.indexOf("[", start + 1)) {
    let depth = 0
    for (let index = start; index < cleaned.length; index += 1) {
      const char = cleaned[index]
      if (char === "[") depth += 1
      else if (char === "]") {
        depth -= 1
        if (depth === 0) {
          try {
            const value = JSON.parse(cleaned.slice(start, index + 1)) as unknown
            if (Array.isArray(value)) return value
          } catch {
            // try next bracket
          }
          break
        }
      }
    }
  }
  return []
}

async function extractAiRules(ctx: StageContext, slices: Array<{ path: string; startLine: number; endLine: number }>): Promise<{ rules: Array<{ ruleId: string; path: string; line: number; summary: string; confidence: number; kind: "threshold" | "branch" | "state" | "sql" | "other" }>; ok: boolean; error?: string }> {
  if (!ctx.ai.enabled || !ctx.ai.provider) return { rules: [], ok: false }
  const selected = slices.slice(0, 3)
  const parts: string[] = []
  for (const slice of selected) {
    const text = await readFile(join(ctx.repoRoot, slice.path), "utf8").catch(() => "")
    if (!text) continue
    const lines = text.split(/\r?\n/).slice(slice.startLine - 1, slice.endLine)
    parts.push(`文件：${slice.path}（${slice.startLine}-${slice.endLine}）\n` + lines.map((line, index) => `${slice.startLine + index}: ${line}`).join("\n"))
  }
  if (parts.length === 0) return { rules: [], ok: false }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  try {
    const turn = await ctx.ai.provider.chat({
      system: "你是政企系统考古专家。只输出 JSON 对象 {\"rules\": [...]}，不要输出任何解释或代码块。每个 rule 字段：summary（中文一句话）, kind（threshold|branch|state|sql|other）, line（给定行号，整数）, confidence（0-1）。",
      messages: [{ role: "user", content: parts.join("\n\n") }],
      tools: [],
      jsonMode: true,
      signal: controller.signal,
    })
    const text = String(turn.text ?? "")
    const strict = parseRules(text)
    const parsed = strict.length > 0 ? strict : parseRuleLines(text)
    const rules: Array<{ ruleId: string; path: string; line: number; summary: string; confidence: number; kind: "threshold" | "branch" | "state" | "sql" | "other" }> = []
    for (const item of parsed.slice(0, 20)) {
      const valid = AiRuleSchema.safeParse(item)
      if (!valid.success) continue
      const slice = selected.find((candidate) => valid.data.line >= candidate.startLine && valid.data.line <= candidate.endLine) ?? selected[0]
      rules.push({ ruleId: `ai_${rules.length + 1}`, path: slice?.path ?? "unknown", line: valid.data.line, summary: valid.data.summary.slice(0, 160), confidence: valid.data.confidence, kind: valid.data.kind })
    }
    if (rules.length === 0) return { rules, ok: false, error: "模型未返回可解析规则" }
    return { rules, ok: true }
  } catch (error) {
    return { rules: [], ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}

/** Stage 2：TS/JS AST 切片、调用图与业务规则提取；其他语言进入 unanalyzed。 */
export async function runStage2(ctx: StageContext): Promise<StageResult> {
  console.log("[s2-debug] ai", ctx.ai.enabled, ctx.ai.provider?.name ?? "none")
  const files = await walkFiles(ctx.repoRoot, { maxFiles: 400 })
  const analysis = await analyzeRepo(files)
  if (analysis.slices.length === 0 && analysis.rules.length === 0) {
    return {
      status: "blocked",
      code: "no_analyzable_source",
      message: "没有可解析的 TS/JS/SQL 源码；MVP 只支持 TypeScript/JavaScript 的 AST 切片",
    }
  }

  await ctx.emit("archaeology.slice", {
    slices: analysis.slices.map((slice) => ({ sliceId: slice.sliceId, path: slice.path, startLine: slice.startLine, endLine: slice.endLine, name: slice.name })),
    callGraphPath: "artifacts/call-graph.json",
  })
  const ai = await extractAiRules(ctx, analysis.slices)
  const seen = new Set<string>()
  const merged = [...ai.rules, ...analysis.rules].filter((rule) => {
    const key = `${rule.path}:${rule.line}:${rule.summary}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const mode = ai.ok ? "ai" : ctx.ai.enabled ? "fallback" : "deterministic"
  await ctx.emit("archaeology.rule", {
    rules: merged.map((rule) => ({ ruleId: rule.ruleId, path: rule.path, line: rule.line, summary: rule.summary, confidence: rule.confidence, kind: rule.kind, confirmed: false, source: rule.ruleId.startsWith("ai_") ? "ai" : "ast" })),
    mode,
    provider: ctx.ai.provider?.name ?? null,
    aiRules: ai.rules.length,
    aiError: ai.error ?? null,
  })
  await ctx.emit("archaeology.unanalyzed", { areas: analysis.unanalyzed })

  const slicesArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 2, name: "code-slices.json", kind: "evidence", content: JSON.stringify(analysis.slices, null, 2) })
  const rulesArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 2, name: "business-rules.json", kind: "report", content: JSON.stringify(merged, null, 2) })
  const graphArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 2, name: "call-graph.json", kind: "evidence", content: JSON.stringify(analysis.callGraph, null, 2) })
  const unanalyzedArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 2, name: "unanalyzed.json", kind: "report", content: JSON.stringify(analysis.unanalyzed, null, 2) })

  return {
    status: "succeeded",
    artifacts: [slicesArtifact, rulesArtifact, graphArtifact, unanalyzedArtifact],
    notes: [`切片 ${analysis.slices.length} 个，规则 ${merged.length} 条（AI ${ai.rules.length}），未分析 ${analysis.unanalyzed.length} 项`, mode === "ai" ? "规则由模型提取并经 JSON Schema 校验" : mode === "fallback" ? "AI 调用失败，已回退确定性规则" : "未接入 AI，使用确定性规则"],
  }
}
