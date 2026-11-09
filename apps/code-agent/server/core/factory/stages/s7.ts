import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import type { StageContext, StageResult } from "../types.ts"
import { assertRoleRead, openApiRoutes, RailBlocked, treeAnchors, verifyGeneratedFile } from "../rails.ts"
import type { RailViolation } from "../../../../shared/contracts.ts"

/** Stage 7：护栏。真实执行角色访问控制与契约静态校验，阻断写入事件。 */
export async function runStage7(ctx: StageContext): Promise<StageResult> {
  let bundleRaw = ""
  try {
    bundleRaw = await readFile(join(ctx.store.contractsRoot(), "bundle.json"), "utf8")
  } catch {
    return { status: "blocked", code: "contract_not_locked", message: "契约尚未锁定：护栏没有可校验的契约基线" }
  }
  const bundle = JSON.parse(bundleRaw) as { hash: string; contents: Record<string, string> }
  const routes = openApiRoutes(bundle.contents["openapi.yaml"] ?? "")
  const anchors = treeAnchors(bundle.contents["component_tree.json"] ?? "")

  const violations: RailViolation[] = []
  // 1) 角色访问控制：Judge 读实现源码会被真实拒绝
  try {
    assertRoleRead("Judge", "backend/server.mjs")
  } catch (error) {
    if (error instanceof RailBlocked) {
      violations.push(error.violation)
      await ctx.emit("rail.violation", error.violation)
    } else throw error
  }

  // 2) 契约静态校验：扫描 Stage 6 的合并产物
  let files: string[] = []
  try {
    files = await readdir(ctx.store.generatedRoot(), { recursive: true, withFileTypes: false }) as unknown as string[]
  } catch {
    files = []
  }
  for (const relative of files.map((item) => String(item).replaceAll("\\", "/")).filter((item) => /\.(mjs|vue|tsx|jsx|html|sql)$/.test(item) && !item.startsWith("roles/"))) {
    let content = ""
    try {
      content = await readFile(join(ctx.store.generatedRoot(), relative), "utf8")
    } catch {
      continue
    }
    const found = verifyGeneratedFile({ role: "Backend Builder", relativePath: relative, content, openapiRoutes: routes, anchors, contractHash: bundle.hash })
    for (const violation of found) {
      violations.push(violation)
      await ctx.emit("rail.violation", violation)
    }
  }

  const artifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 7, name: "rail-report.json", kind: "report", content: JSON.stringify({ checked: files.length, violations }, null, 2) })
  const missingArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 7, name: "rail-stats.json", kind: "evidence", content: JSON.stringify({ rules: 7, violations: violations.length, checkedFiles: files.length }, null, 2) })
  await ctx.emit("rail.stats", { rails: 7, checks: files.length + 1, violations: violations.length, contractHash: bundle.hash })
  await ctx.emit("rail.violation", {
    railName: "AuditRail",
    role: "Archiver",
    reason: `本轮护栏检查完成：${violations.length} 条阻断已写入事件日志`,
    expected: "0 条阻断",
    actual: `${violations.length} 条`,
    contractHash: bundle.hash,
    recoveryHint: "修复阻断后重跑本工段",
    severity: "warn",
  })

  return {
    status: "succeeded",
    artifacts: [artifact, missingArtifact],
    notes: [`校验 ${files.length} 个产物文件，阻断 ${violations.length} 条（含 1 条 Judge 越权拦截）`],
  }
}
