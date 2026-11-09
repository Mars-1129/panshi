import type { Check, Report } from "../../shared/types.ts"
import { summarizeChecks } from "./checks.ts"

export function buildReport(input: {
  summary: string
  changedFiles: number
  additions: number
  deletions: number
  checks: Check[]
  baseline?: Check[]
  risks: string[]
  unverified: string[]
}): Report {
  const counts = summarizeChecks(input.checks)
  return {
    summary: input.summary,
    changedFiles: input.changedFiles,
    additions: input.additions,
    deletions: input.deletions,
    checks: counts,
    baseline: input.baseline ? summarizeChecks(input.baseline) : undefined,
    risks: input.risks,
    unverified: input.unverified,
    generatedAt: new Date().toISOString(),
  }
}

export function collectUnverified(checks: Check[]): string[] {
  const warnings: string[] = []
  if (checks.length === 0) {
    warnings.push("No verification command was available for this repository.")
  }
  for (const check of checks) {
    if (check.status === "skipped") {
      warnings.push(`${check.label} was skipped: ${check.reason ?? "no reason recorded"}`)
    }
    if (check.status === "failed" && check.timedOut) {
      warnings.push(`${check.label} timed out after ${check.durationMs ?? 0}ms.`)
    }
  }
  return warnings
}

export function classifyFailure(check: Check): "environment" | "dependency" | "test" | "implementation" | "unknown" {
  const text = `${check.stdout ?? ""}\n${check.stderr ?? ""}`.toLowerCase()
  if (check.timedOut) return "environment"
  if (/command not found|enoent|no such file or directory|not recognized as an internal/.test(text)) return "dependency"
  if (/cannot find module|module not found|err_module_not_found/.test(text)) return "dependency"
  if (check.status === "failed" && check.exitCode !== null) return "test"
  return "unknown"
}
