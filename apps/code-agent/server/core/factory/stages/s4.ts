import { spawnSync } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { StageContext, StageResult } from "../types.ts"
import { ensureDir } from "../../fs-utils.ts"
import { McpClient, MCP_SERVER_SOURCE, buildWrapperSource, normalizeTools, type McpTool } from "../mcp.ts"

/** Stage 4：把一个本地 MCP 工具转换为 SkillPack，并在沙箱里跑 Harness。 */
export async function runStage4(ctx: StageContext): Promise<StageResult> {
  const toolsDir = join(ctx.store.workspaceRoot(), "mcp-invoice")
  await ensureDir(toolsDir)
  const serverPath = join(toolsDir, "server.mjs")
  await writeFile(serverPath, MCP_SERVER_SOURCE, "utf8")

  const client = new McpClient(serverPath)
  try {
    await client.start()
    await client.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "panshi-harness", version: "0.1.0" } })
    const listed = await client.request("tools/list")
    const tools = normalizeTools(listed)
    if (tools.length === 0) return { status: "failed", code: "no_tools", message: "MCP server 没有暴露任何工具" }

    const tool = tools[0] as McpTool
    const wrapperSource = buildWrapperSource(tool, serverPath)
    const wrapperPath = join(toolsDir, "wrapper.mjs")
    await writeFile(wrapperPath, wrapperSource, "utf8")

    const skillMd = `---
name: vat-invoice-verify
description: ${tool.description || "核验增值税发票"}
version: 0.1.0
source: ${serverPath}
tool: ${tool.name}
input_schema: ${JSON.stringify(tool.inputSchema)}
---

# vat-invoice-verify

由 Meta-Skill Builder 从本地 MCP server 自省生成；wrapper 强制超时、异常捕获与数值非空。

## 调用

\`\`\`bash
node wrapper.mjs '{"invoiceNo":"INV-001","amountCents":10000}'
\`\`\`
`
    const skillPath = join(toolsDir, "SKILL.md")
    await writeFile(skillPath, skillMd, "utf8")

    const cases = [
      { name: "normal", args: { invoiceNo: "INV-001", amountCents: 10000 }, expectTax: true },
      { name: "tax_free_null", args: { invoiceNo: "INV-FREE", amountCents: 0 }, expectTax: false },
      { name: "missing_invoice_no", args: { amountCents: 100 }, expectError: true },
    ]
    const results: Array<{ name: string; ok: boolean; output: string }> = []
    for (const testCase of cases) {
      if (testCase.expectError) {
        try {
          await client.request("tools/call", { name: tool.name, arguments: testCase.args })
          results.push({ name: testCase.name, ok: false, output: "expected error but got result" })
        } catch (error) {
          results.push({ name: testCase.name, ok: true, output: error instanceof Error ? error.message : "error" })
        }
        continue
      }
      const called = spawnSync(process.execPath, [wrapperPath, JSON.stringify(testCase.args)], { encoding: "utf8", timeout: 15_000, windowsHide: true })
      const output = (called.stdout ?? "").trim()
      let parsed: { ok?: boolean; taxAmount?: number } = {}
      try {
        parsed = JSON.parse(output) as { ok?: boolean; taxAmount?: number }
      } catch {
        results.push({ name: testCase.name, ok: false, output: output || called.stderr || "empty output" })
        continue
      }
      const ok = parsed.ok === true && typeof parsed.taxAmount === "number" && Number.isFinite(parsed.taxAmount)
      results.push({ name: testCase.name, ok, output })
    }
    const passed = results.filter((item) => item.ok).length
    const failed = results.length - passed

    await ctx.emit("skill.build", { skillId: "vat-invoice-verify", name: "vat-invoice-verify", tool: tool.name, skillMdPath: skillPath, wrapperPath })
    await ctx.emit("skill.harness", { cases: results.length, passed, failed })
    await ctx.emit("skill.license", { license: "MIT", dependencies: [], findings: [] })
    await ctx.emit("skill.register", { registryEntry: "vat-invoice-verify@0.1.0", prDraftPath: "artifacts/skillhub-pr.md" })

    const harnessArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 4, name: "harness-report.json", kind: "evidence", content: JSON.stringify({ tool, results }, null, 2) })
    const skillArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 4, name: "SKILL.md", kind: "skillpack", content: skillMd })
    const wrapperArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 4, name: "wrapper.mjs", kind: "code", content: wrapperSource })
    const prArtifact = await ctx.store.saveArtifact({
      taskId: ctx.taskId,
      stage: 4,
      name: "skillhub-pr.md",
      kind: "report",
      content: `# SkillHub PR 草稿\n\n- skill: vat-invoice-verify\n- tool: ${tool.name}\n- source: ${serverPath}\n- harness: ${passed}/${results.length} 通过\n\n> 仅生成可审核产物，不自动推送。\n`,
    })

    if (failed > 0) {
      return { status: "failed", code: "harness_failed", message: `Harness ${passed}/${results.length} 通过`, artifacts: [harnessArtifact, skillArtifact, wrapperArtifact, prArtifact] }
    }
    return { status: "succeeded", artifacts: [skillArtifact, wrapperArtifact, harnessArtifact, prArtifact], notes: [`MCP 工具 ${tool.name} 转换完成，Harness ${passed}/${results.length}`] }
  } catch (error) {
    return { status: "blocked", code: "mcp_unavailable", message: error instanceof Error ? error.message : "MCP 调用失败" }
  } finally {
    client.close()
  }
}
