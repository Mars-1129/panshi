import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { inferChecks, runChecks, splitCommand, summarizeChecks } from "../../server/core/checks.ts"
import { CommandRunner } from "../../server/core/command-runner.ts"
import { DEFAULT_LIMITS } from "../../server/core/config.ts"
import type { RepoSummary } from "../../shared/types.ts"

function summary(overrides: Partial<RepoSummary> = {}): RepoSummary {
  return {
    root: "/tmp/repo",
    name: "repo",
    isGit: true,
    languages: ["TypeScript"],
    packageManager: "npm",
    scripts: {},
    entrypoints: [],
    hasUncommittedChanges: false,
    ...overrides,
  }
}

describe("inferChecks", () => {
  it("uses package.json scripts in a stable order", () => {
    const checks = inferChecks(summary({ scripts: { test: "vitest", build: "tsc", lint: "eslint .", typecheck: "tsc --noEmit" } }))
    expect(checks.map((check) => check.id)).toEqual(["check_typecheck", "check_lint", "check_test", "check_build"])
    expect(checks[0]?.command).toBe("npm run typecheck")
  })

  it("returns no checks when the repository has nothing runnable", () => {
    expect(inferChecks(summary())).toEqual([])
  })

  it("falls back to go test", () => {
    const checks = inferChecks(summary({ packageManager: "go" }))
    expect(checks[0]?.command).toBe("go test ./...")
  })
})

describe("runChecks", () => {
  it("records real exit codes and never invents a pass", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "checks-"))
    const runner = new CommandRunner()
    const checks = await runChecks(
      [{ id: "c1", label: "Failing", command: "node -e process.exit(3)", required: true }],
      { runner, cwd, limits: DEFAULT_LIMITS },
    )
    expect(checks[0]?.status).toBe("failed")
    expect(checks[0]?.exitCode).toBe(3)
  })

  it("marks a passed command with exit code 0", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "checks-"))
    const runner = new CommandRunner()
    const checks = await runChecks(
      [{ id: "c1", label: "Passing", command: "node -e process.exit(0)", required: true }],
      { runner, cwd, limits: DEFAULT_LIMITS },
    )
    expect(checks[0]).toMatchObject({ status: "passed", exitCode: 0 })
    expect(checks[0]?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("marks blocked commands as skipped with a reason", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "checks-"))
    const runner = new CommandRunner()
    const checks = await runChecks(
      [{ id: "c1", label: "Install", command: "npm install", required: true }],
      { runner, cwd, limits: DEFAULT_LIMITS },
    )
    expect(checks[0]?.status).toBe("skipped")
    expect(checks[0]?.reason).toBeTruthy()
    expect(summarizeChecks(checks)).toMatchObject({ passed: 0, failed: 0, skipped: 1 })
  })

  it("marks timeouts as failed", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "checks-"))
    const runner = new CommandRunner()
    const checks = await runChecks(
      [{ id: "c1", label: "Slow", command: "node -e setTimeout(()=>{},20000)", required: true }],
      { runner, cwd, limits: { ...DEFAULT_LIMITS, commandTimeoutMs: 500 } },
    )
    expect(checks[0]?.status).toBe("failed")
    expect(checks[0]?.timedOut).toBe(true)
  })
})

describe("splitCommand", () => {
  it("splits quoted arguments", () => {
    expect(splitCommand('npm run test -- --grep "a b"')).toEqual(["npm", "run", "test", "--", "--grep", "a b"])
  })
})
