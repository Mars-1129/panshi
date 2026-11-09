import { cp, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { StageContext, StageResult } from "../types.ts"
import { ensureDir } from "../../fs-utils.ts"
import { walkFiles } from "../files.ts"

const COPY_SKIP = new Set([".git", "node_modules", ".repo-agent", ".repopilot", "dist"])

/** Stage 1：在隔离副本里做一次真实构建尝试，记录命令、退出码与错误分类。 */
export async function runStage1(ctx: StageContext): Promise<StageResult> {
  const workspace = join(ctx.store.workspaceRoot(), "legacy")
  await ensureDir(workspace)
  const files = await walkFiles(ctx.repoRoot, { maxFiles: 500 })
  for (const file of files) {
    const [top] = file.path.split("/")
    if (!top || COPY_SKIP.has(top)) continue
    const target = join(workspace, file.path)
    await ensureDir(join(target, ".."))
    await cp(file.absolute, target)
  }

  let command = "npm run test"
  try {
    const pkg = JSON.parse(await readFile(join(workspace, "package.json"), "utf8")) as { scripts?: Record<string, string> }
    const scripts = pkg.scripts ?? {}
    const chosen = ["test", "build", "typecheck"].find((name) => scripts[name])
    if (chosen) command = `npm run ${chosen}`
  } catch {
    return {
      status: "blocked",
      code: "no_build_entry",
      message: "仓库没有 package.json，MVP 只支持 Node 生态的旧项目构建尝试",
    }
  }

  const [exec, ...args] = command.split(" ")
  const result = await ctx.runner.run({
    command: exec ?? "npm",
    args,
    cwd: workspace,
    timeoutMs: ctx.limits.commandTimeoutMs,
    maxOutputBytes: ctx.limits.maxOutputBytes,
    signal: ctx.signal,
  })

  const classification = result.timedOut
    ? "timeout"
    : result.exitCode === 0
      ? "ok"
      : /not recognized|command not found|ENOENT|Cannot find module|MODULE_NOT_FOUND/i.test(`${result.stdout}\n${result.stderr}`)
        ? "dependency"
        : /syntax error|unexpected token/i.test(result.stderr)
          ? "implementation"
          : "test"

  const log = `$ ${command}\nexit=${result.exitCode ?? "null"} duration=${result.durationMs}ms\n\n[stdout]\n${result.stdout}\n\n[stderr]\n${result.stderr}`
  const diagnosisArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 1, name: "environment-diagnosis.md", kind: "report", content: log })
  const verdictArtifact = await ctx.store.saveArtifact({
    taskId: ctx.taskId,
    stage: 1,
    name: "run-verdict.json",
    kind: "evidence",
    content: JSON.stringify({ command, exitCode: result.exitCode, classification, runnable: result.exitCode === 0 || classification === "test" }, null, 2),
  })
  const buildLog = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 1, name: "build.log", kind: "evidence", content: log })

  await ctx.emit("greenbuild.diagnosis", {
    command,
    exitCode: result.exitCode,
    classification,
    logPath: diagnosisArtifact.path,
    stderrTail: result.stderr.slice(-800),
    outputTail: `${result.stdout}\n${result.stderr}`.slice(-800),
  })
  const conflicts = classification === "dependency" ? [{ package: "unknown", required: "未知", resolved: "未解决", reason: result.stderr.slice(-400) }] : []
  await ctx.emit("greenbuild.conflicts", { conflicts })
  const verdict = { runnable: result.exitCode === 0 || classification === "test", unresolved: conflicts.map((item) => item.package) }
  await ctx.emit("greenbuild.verdict", verdict)

  if (result.blocked) {
    return { status: "blocked", code: "command_blocked", message: result.blocked }
  }
  return {
    status: "succeeded",
    artifacts: [diagnosisArtifact, verdictArtifact, buildLog],
    notes: [`构建命令 ${command} 退出码 ${result.exitCode ?? "null"}（${classification}）`],
  }
}
