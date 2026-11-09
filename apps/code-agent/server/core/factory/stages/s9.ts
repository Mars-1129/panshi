import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { StageContext, StageResult } from "../types.ts"
import { STAGE_NAMES } from "../types.ts"

type EventLine = { seq?: number; type?: string; payload?: Record<string, unknown> }

async function readEvents(runDir: string): Promise<EventLine[]> {
  try {
    const raw = await readFile(join(runDir, "events.jsonl"), "utf8")
    return raw.split(/\r?\n/).filter(Boolean).map((line) => {
      try {
        return JSON.parse(line) as EventLine
      } catch {
        return {}
      }
    })
  } catch {
    return []
  }
}

/** Stage 9：交付报告 + 证据链 + RSI 经验包 + SkillHub PR 草稿。全部来自真实阶段结果。 */
export async function runStage9(ctx: StageContext): Promise<StageResult> {
  const stages = await ctx.store.listStages()
  const artifacts = await ctx.store.listArtifacts()
  const events = await readEvents(ctx.runDir)
  const blocked = stages.filter((item) => item.status === "blocked" || item.status === "failed")
  // 不适用的工段从「阻断」与分母中排除：没有黑盒不等于失败。
  const skipped = stages.filter((item) => item.status === "not_applicable")
  const approvalEvents = events.filter((event) => event.type === "approval.resolved" && (event.payload?.decision === "approved" || event.payload?.approved === true))
  const approvals = approvalEvents.length

  const stats = [
    { label: "证据事件", value: events.length },
    { label: "产物", value: artifacts.length },
    { label: "人工介入", value: approvals },
    { label: "阻断工段", value: blocked.length },
    { label: "不适用", value: skipped.length },
  ]
  const evidence = events.slice(-8).map((event) => ({ seq: Number(event.seq ?? 0), type: String(event.type ?? "unknown"), ref: `${ctx.taskId}:${String(event.seq ?? 0)}` }))
  const report = {
    runId: ctx.taskId,
    generatedAt: new Date().toISOString(),
    stages: stages.map((item) => ({ stage: item.stage, status: item.status, durationMs: item.finishedAt ? Date.parse(item.finishedAt) - Date.parse(item.startedAt) : 0 })),
    stats,
    evidence,
    blocked: blocked.map((item) => `工段 ${String(item.stage).padStart(2, "0")} ${STAGE_NAMES[item.stage]}：${item.failure?.message ?? "未完成"}`),
    unverified: [
      ...blocked.map((item) => `${STAGE_NAMES[item.stage]} 未通过：${item.failure?.code ?? "blocked"}`),
      ...(events.some((event) => event.type === "cruise.error") ? ["浏览器巡航未执行（Playwright 未安装）"] : []),
    ],
    notApplicable: skipped.map((item) => `工段 ${String(item.stage).padStart(2, "0")} ${STAGE_NAMES[item.stage]}：本仓库不适用`),
    verified: blocked.length === 0,
  }
  const license = events.find((event) => event.type === "skill.license")?.payload?.license
  const registry = events.find((event) => event.type === "skill.register")?.payload?.registryEntry
  const sourceEntries = [
    { id: "legacy-repo", kind: "legacy", name: ctx.repoRoot.split(/[\\/]/).pop() ?? ctx.repoRoot, origin: ctx.repoRoot, license: "unknown", note: "旧系统源码：许可证未知，改造前需人工确认" },
    ...(registry ? [{ id: "mcp-skill", kind: "tool", name: String(registry), origin: "local-mcp", license: String(license ?? "unknown"), note: "本地 MCP 工具，已登记" }] : []),
    { id: "contracts", kind: "generated", name: "schema.sql / openapi.yaml / component_tree.json", origin: "PanShi Stage 5", license: "internal", note: "由 PanShi 生成的契约" },
    { id: "generated-roles", kind: "generated", name: "Database / Backend / Frontend 角色产物", origin: "PanShi Stage 6", license: "internal", note: "由 PanShi 角色生成并合并" },
  ]
  const unknownLicenses = sourceEntries.filter((item) => item.license === "unknown").length
  const sourceLedger = { entries: sourceEntries, total: sourceEntries.length, unknownLicenses }
  const ledgerPath = await ctx.store.writeJson("source-ledger.json", sourceLedger)
  const ledgerArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 9, name: "source-ledger.json", kind: "report", content: JSON.stringify(sourceLedger, null, 2) })
  await ctx.emit("source.ledger", { entries: sourceEntries, total: sourceEntries.length, unknownLicenses, ledgerPath })
  const reportPath = await ctx.store.writeJson("delivery.json", report)
  const reportArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 9, name: "delivery-report.json", kind: "report", content: JSON.stringify(report, null, 2) })

  const evolution = `# Evolution SkillPack · 本次运行沉淀

## 来源
- runId: ${ctx.taskId}
- 工段: ${stages.map((item) => `${item.stage}:${item.status}`).join(" / ")}
- 产物: ${artifacts.length} 个

## 可复用经验
${blocked.length > 0 ? blocked.map((item) => `- 阻断：${STAGE_NAMES[item.stage]} — ${item.failure?.message ?? ""}`).join("\n") : "- 全链路通过，无阻断记录"}

## 边界
只沉淀本次真实执行过的步骤；未执行项不写入经验。
`
  const evolutionArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 9, name: "evolution-skillpack.md", kind: "skillpack", content: evolution })
  const prDraft = `# SkillHub PR 草稿（可审核，不自动推送）

- skill: panshi-evolution-${ctx.taskId}
- 来源: ${ctx.repoRoot}
- 证据: ${reportPath}
- 结论: ${report.verified ? "全部工段通过" : `${blocked.length} 个工段阻断`}
`
  const prArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 9, name: "skillhub-pr.md", kind: "report", content: prDraft })

  await ctx.emit("delivery.report", { reportPath, stats, verified: report.verified, blocked: report.blocked, unverified: report.unverified, approvals: approvalEvents.map((event) => ({ stage: Number(event.payload?.stage ?? 0), kind: String(event.payload?.kind ?? ""), subject: String(event.payload?.subject ?? ""), decision: String(event.payload?.decision ?? ""), actor: String(event.payload?.actor ?? ""), at: String(event.payload?.at ?? "") })), evolution: { name: "panshi-evolution", generated: true }, prDraft: { state: "draft", path: prArtifact.path } })
  await ctx.emit("rsi.evolution", { packId: `evo_${ctx.taskId}`, name: "panshi-evolution", sourceRefs: [reportPath] })

  return {
    status: "succeeded",
    artifacts: [reportArtifact, evolutionArtifact, prArtifact, ledgerArtifact],
    notes: [`交付报告已生成：${report.verified ? "全部通过" : `${blocked.length} 个工段阻断`}`, `证据事件 ${events.length} 条，产物 ${artifacts.length} 个`],
  }
}
