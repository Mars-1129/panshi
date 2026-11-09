import type { Check, Limits, PlanCheck, RepoSummary } from "../../shared/types.ts"
import type { CommandRunner } from "./command-runner.ts"

const SCRIPT_ORDER = ["typecheck", "lint", "test", "build"] as const

const SCRIPT_LABELS: Record<string, string> = {
  typecheck: "Type check",
  lint: "Lint",
  test: "Tests",
  build: "Build",
}

export function inferChecks(summary: RepoSummary): PlanCheck[] {
  const checks: PlanCheck[] = []
  const packageManager = summary.packageManager === "unknown" ? "npm" : summary.packageManager
  const hasPackageScripts = Object.keys(summary.scripts).length > 0

  if (hasPackageScripts) {
    for (const script of SCRIPT_ORDER) {
      if (!summary.scripts[script]) continue
      checks.push({
        id: `check_${script}`,
        label: SCRIPT_LABELS[script],
        command: `${packageManager} run ${script}`,
        required: true,
      })
    }
    return checks
  }

  if (summary.packageManager === "go") {
    checks.push({ id: "check_test", label: "Go tests", command: "go test ./...", required: true })
  } else if (summary.packageManager === "cargo") {
    checks.push({ id: "check_test", label: "Cargo tests", command: "cargo test", required: true })
  } else if (summary.packageManager === "uv" || summary.packageManager === "poetry" || summary.packageManager === "python") {
    checks.push({ id: "check_test", label: "Python tests", command: "python -m pytest -q", required: true })
  }

  return checks
}

export type CheckRunContext = {
  runner: CommandRunner
  cwd: string
  limits: Limits
  signal?: AbortSignal
  onStart?: (check: Check) => void | Promise<void>
  onFinish?: (check: Check) => void | Promise<void>
}

export async function runChecks(planChecks: PlanCheck[], context: CheckRunContext): Promise<Check[]> {
  const results: Check[] = []
  for (const planCheck of planChecks) {
    const [command, ...args] = splitCommand(planCheck.command)
    const running: Check = { ...planCheck, status: "running" }
    await context.onStart?.(running)

    const result = await context.runner.run({
      command,
      args,
      cwd: context.cwd,
      timeoutMs: context.limits.commandTimeoutMs,
      maxOutputBytes: context.limits.maxOutputBytes,
      signal: context.signal,
    })

    let finished: Check
    if (result.blocked) {
      finished = { ...planCheck, status: "skipped", reason: result.blocked, exitCode: null, durationMs: result.durationMs }
    } else if (result.timedOut) {
      finished = {
        ...planCheck,
        status: "failed",
        exitCode: null,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        timedOut: true,
        reason: `Timed out after ${context.limits.commandTimeoutMs}ms`,
      }
    } else if (result.exitCode === 0) {
      finished = {
        ...planCheck,
        status: "passed",
        exitCode: 0,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
      }
    } else {
      finished = {
        ...planCheck,
        status: "failed",
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
      }
    }
    results.push(finished)
    await context.onFinish?.(finished)
  }
  return results
}

export function summarizeChecks(checks: Check[]): { total: number; passed: number; failed: number; skipped: number } {
  return {
    total: checks.length,
    passed: checks.filter((check) => check.status === "passed").length,
    failed: checks.filter((check) => check.status === "failed").length,
    skipped: checks.filter((check) => check.status === "skipped").length,
  }
}

export function splitCommand(command: string): string[] {
  return command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? []
}
