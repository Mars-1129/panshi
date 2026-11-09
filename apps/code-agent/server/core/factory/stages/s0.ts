import { platform, release } from "node:os"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ProjectManifestSchema, type SecretScanReport } from "../../../../shared/contracts.ts"
import type { StageContext, StageResult } from "../types.ts"
import { hashFile, walkFiles } from "../files.ts"
import { scanSecrets } from "../secrets.ts"

/** Stage 0：输入资产清单 + 基线 + 敏感信息扫描 + 环境摘要。全部真实读取。 */
export async function runStage0(ctx: StageContext): Promise<StageResult> {
  const files = await walkFiles(ctx.repoRoot, { maxFiles: 2000 })
  const assets: Array<{ path: string; hash: string; bytes: number }> = []
  for (const file of files.slice(0, 200)) {
    assets.push({ path: file.path, hash: await hashFile(file.absolute), bytes: file.bytes })
  }
  const baseRevision = await ctx.git.baseRevision(ctx.repoRoot).catch(() => undefined)
  const manifest = ProjectManifestSchema.parse({
    projectId: ctx.taskId,
    name: "PanShi-SwarmFactory",
    root: ctx.repoRoot,
    assets,
    baseRevision,
    createdAt: new Date().toISOString(),
  })
  await ctx.emit("baseline.manifest", { projectId: manifest.projectId, assets: assets.length, baseRevision: baseRevision ?? null })

  const scan = await scanSecrets(files)
  const report: SecretScanReport = { scannedFiles: scan.scanned, findings: scan.findings, skipped: scan.skipped }
  await ctx.emit("baseline.secretScan", { scannedFiles: scan.scanned, findings: scan.findings.length, masked: scan.findings.slice(0, 5) })

  let packageManager = "unknown"
  let scripts: Record<string, string> = {}
  try {
    const raw = JSON.parse(await readFile(join(ctx.repoRoot, "package.json"), "utf8")) as { scripts?: Record<string, string> }
    scripts = raw.scripts ?? {}
    packageManager = "npm"
  } catch {
    // 不是 Node 项目：保持 unknown，不猜测
  }
  const languages = [...new Set(files.map((file) => file.path.split(".").pop() ?? "").filter(Boolean))].slice(0, 8)
  const entrypoints = files.map((file) => file.path).filter((path) => /^(src\/)?(index|main)\.(mjs|js|ts)$/.test(path)).slice(0, 5)

  const env = { packageManager, languages, entrypoints, scripts, node: process.version, platform: `${platform()} ${release()}` }
  await ctx.emit("baseline.environment", env)

  const manifestArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 0, name: "project-manifest.json", kind: "other", content: JSON.stringify(manifest, null, 2) })
  const scanArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 0, name: "secret-scan.json", kind: "evidence", content: JSON.stringify(report, null, 2) })
  const envArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 0, name: "environment.json", kind: "other", content: JSON.stringify(env, null, 2) })

  return {
    status: "succeeded",
    artifacts: [manifestArtifact, scanArtifact, envArtifact],
    notes: [
      `资产 ${assets.length} 个，基线 ${baseRevision ? baseRevision.slice(0, 12) : "无 HEAD"}`,
      `敏感信息命中 ${scan.findings.length} 处（已掩码，不落明文）`,
    ],
  }
}
