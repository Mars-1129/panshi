import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_LIMITS } from "../../server/core/config.ts"
import type { Config } from "../../server/core/config.ts"
import { FakeProvider, type ProviderTurn } from "../../server/core/provider.ts"
import { Runtime } from "../../server/core/runtime.ts"
import { createTempRepo, git, type TempRepo } from "../helpers/repo.ts"

const PLAN = {
  summary: "Fix sum",
  steps: [{ title: "Fix sum", detail: "" }],
  files: [{ path: "sum.mjs", reason: "" }],
  risks: [],
}

const FIX = "export function sum(a, b) {\n  return a + b\n}\n"

let repo: TempRepo
let runtime: Runtime | undefined

beforeEach(async () => {
  repo = await createTempRepo()
})

afterEach(async () => {
  await runtime?.waitForAll().catch(() => undefined)
  runtime = undefined
  await repo.cleanup()
})

function config(repoRoot: string, overrides: Partial<Config> = {}): Config {
  return {
    provider: { name: "siliconflow", baseUrl: "http://localhost:1", model: "fake", apiKey: "x", configured: true },
    repoRoot,
    aiConfigPath: repoRoot + "/.ai-test.json",
    port: 0,
    limits: DEFAULT_LIMITS,
    ...overrides,
  }
}

async function start(turns: ProviderTurn[], options: { reconcile?: boolean } = {}): Promise<Runtime> {
  runtime = new Runtime({
    config: config(repo.root, { limits: { ...DEFAULT_LIMITS, maxTurns: 5, maxRepairLoops: 0 } }),
    provider: new FakeProvider({ plan: PLAN, turnsFactory: () => turns.map((turn) => ({ ...turn })) }),
    reconcileInterrupted: options.reconcile ?? true,
  })
  await runtime.init()
  return runtime
}

async function planAndApprove(active: Runtime): Promise<string> {
  const created = await active.createTask({ title: "Fix sum", summary: "", mode: "generate" })
  await active.waitForTask(created.id)
  await active.approve(created.id, active.getTask(created.id).plan?.hash)
  return created.id
}

describe("false-success regressions", () => {
  it("does not report success when the agent reverts its own work before finishing", async () => {
    const base = git(repo.root, ["rev-parse", "HEAD"]).trim()
    await start([
      { text: "write", toolCalls: [{ id: "w1", name: "repo_write", arguments: { path: "sum.mjs", content: FIX } }] },
      { text: "revert to base", toolCalls: [{ id: "e1", name: "exec", arguments: { command: "git", args: ["checkout", base, "--", "sum.mjs"] } }] },
      { text: "finish", toolCalls: [{ id: "f1", name: "finish", arguments: {} }] },
    ])
    const id = await planAndApprove(runtime as Runtime)
    await (runtime as Runtime).waitForTask(id)
    const finished = (runtime as Runtime).getTask(id)
    // Either outcome is honest: the reverted tree has no diff, and it also fails its check.
    expect(finished.status).toBe("failed")
    expect(["no_changes", "check_failed"]).toContain(finished.error?.code)
    expect(finished.patches).toHaveLength(0)
    expect(finished.report?.changedFiles).toBe(0)
  })

  it("blocks git commands that would erase the run's own evidence", async () => {
    await start([{ text: "reset", toolCalls: [{ id: "e1", name: "exec", arguments: { command: "git", args: ["reset", "--hard"] } }, { id: "f1", name: "finish", arguments: {} }] }])
    const id = await planAndApprove(runtime as Runtime)
    await (runtime as Runtime).waitForTask(id)
    const events = await (runtime as Runtime).events(id, 0)
    const exec = events.find((event) => event.type === "tool.finished" && (event.payload as { tool?: string }).tool === "exec")
    expect(exec?.payload).toMatchObject({ ok: false })
  })

  it("requires a review to actually read file content", async () => {
    const reviewPlan = { ...PLAN, files: [], steps: [{ title: "Inspect", detail: "" }] }
    runtime = new Runtime({
      config: config(repo.root),
      provider: new FakeProvider({
        plan: reviewPlan,
        turnsFactory: () => [
          { text: "status only", toolCalls: [{ id: "s1", name: "git_status", arguments: {} }] },
          { text: "report", toolCalls: [{ id: "r1", name: "report_findings", arguments: { findings: [{ severity: "low", title: "x", path: "sum.mjs", line: 1, detail: "" }] } }] },
          { text: "finish", toolCalls: [{ id: "f1", name: "finish", arguments: {} }] },
        ],
      }),
    })
    await runtime.init()
    const created = await runtime.createTask({ title: "Review", summary: "", mode: "review" })
    await runtime.waitForTask(created.id)
    await runtime.approve(created.id, runtime.getTask(created.id).plan?.hash)
    await runtime.waitForTask(created.id)
    const finished = runtime.getTask(created.id)
    expect(finished.status).toBe("failed")
    expect(finished.error?.code).toBe("review_incomplete")

    const { ProviderError } = await import("../../server/core/provider.ts")
    expect(new ProviderError("x", "y")).toBeInstanceOf(Error)
  })

  it("accepts a review that read a file and reported findings", async () => {
    runtime = new Runtime({
      config: config(repo.root),
      provider: new FakeProvider({
        plan: { ...PLAN, files: [], steps: [{ title: "Inspect", detail: "" }] },
        turnsFactory: () => [
          { text: "read", toolCalls: [{ id: "r0", name: "repo_read", arguments: { path: "sum.mjs" } }] },
          { text: "report", toolCalls: [{ id: "r1", name: "report_findings", arguments: { findings: [{ severity: "high", title: "sum subtracts", path: "sum.mjs", line: 2, detail: "" }] } }] },
          { text: "finish", toolCalls: [{ id: "f1", name: "finish", arguments: {} }] },
        ],
      }),
    })
    await runtime.init()
    const created = await runtime.createTask({ title: "Review", summary: "", mode: "review" })
    await runtime.waitForTask(created.id)
    await runtime.approve(created.id, runtime.getTask(created.id).plan?.hash)
    await runtime.waitForTask(created.id)
    const finished = runtime.getTask(created.id)
    expect(finished.status).toBe("succeeded")
    expect(finished.findings).toHaveLength(1)
    expect(finished.report?.unverified.join(" ")).toContain("Read-only review")
  })
})

describe("cancellation regressions", () => {
  it("stops the run before returning from cancel", async () => {
    await start([
      { text: "read", toolCalls: [{ id: "r1", name: "repo_read", arguments: { path: "sum.mjs" } }] },
      { text: "read", toolCalls: [{ id: "r2", name: "repo_read", arguments: { path: "test.mjs" } }] },
      { text: "write", toolCalls: [{ id: "w1", name: "repo_write", arguments: { path: "sum.mjs", content: FIX } }] },
      { text: "finish", toolCalls: [{ id: "f1", name: "finish", arguments: {} }] },
    ])
    const id = await planAndApprove(runtime as Runtime)
    const cancelled = await (runtime as Runtime).cancel(id)
    expect(cancelled.status).toBe("cancelled")
    // Undo must be accepted immediately: the run has already unwound.
    await expect((runtime as Runtime).undo(id, "cp_initial")).resolves.toBeDefined()
    const worktreeFile = git(repo.root, ["-C", join(repo.root, ".repopilot/worktrees", id), "show", "HEAD:sum.mjs"])
    expect(worktreeFile).toContain("a - b")
  })

  it("keeps duplicate approvals idempotent under concurrency", async () => {
    await start([
      { text: "write", toolCalls: [{ id: "w1", name: "repo_write", arguments: { path: "sum.mjs", content: FIX } }] },
      { text: "finish", toolCalls: [{ id: "f1", name: "finish", arguments: {} }] },
    ])
    const created = await (runtime as Runtime).createTask({ title: "Fix sum", summary: "", mode: "generate" })
    await (runtime as Runtime).waitForTask(created.id)
    const hash = (runtime as Runtime).getTask(created.id).plan?.hash
    const results = await Promise.allSettled([
      (runtime as Runtime).approve(created.id, hash),
      (runtime as Runtime).approve(created.id, hash),
      (runtime as Runtime).approve(created.id, hash),
    ])
    // At most one may reject, and only with a runtime error, never an invalid transition.
    const rejected = results.filter((result) => result.status === "rejected")
    expect(rejected.length).toBeLessThanOrEqual(1)
    for (const item of rejected) {
      expect((item as PromiseRejectedResult).reason).toMatchObject({ status: 409 })
    }
    await (runtime as Runtime).waitForTask(created.id)
    expect((runtime as Runtime).getTask(created.id).status).toBe("succeeded")
  })
})

describe("reconcile ownership", () => {
  it("does not mark a live run as interrupted when reconcile is disabled", async () => {
    await start([{ text: "write", toolCalls: [{ id: "w1", name: "repo_write", arguments: { path: "sum.mjs", content: FIX } }] }])
    const created = await (runtime as Runtime).createTask({ title: "Fix sum", summary: "", mode: "generate" })
    await (runtime as Runtime).waitForTask(created.id)
    const metaPath = join(repo.root, ".repo-agent", "runs", created.id, "meta.json")
    const raw = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>
    raw.status = "acting"
    await writeFile(metaPath, JSON.stringify(raw), "utf8")

    const observer = new Runtime({ config: config(repo.root), provider: new FakeProvider({ plan: PLAN }), reconcileInterrupted: false })
    await observer.init()
    expect(observer.getTask(created.id).status).toBe("acting")

    const owner = new Runtime({ config: config(repo.root), provider: new FakeProvider({ plan: PLAN }), reconcileInterrupted: true })
    await owner.init()
    expect(owner.getTask(created.id).status).toBe("failed")
    expect(owner.getTask(created.id).error?.code).toBe("interrupted")
  })
})
