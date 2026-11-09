import { access, readFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_LIMITS, resolveProvider } from "../../server/core/config.ts"
import type { Config } from "../../server/core/config.ts"
import { FakeProvider, ProviderError, type ProviderTurn } from "../../server/core/provider.ts"
import { Runtime } from "../../server/core/runtime.ts"
import type { RepoSummary } from "../../shared/types.ts"
import { createTempRepo, git, type TempRepo } from "../helpers/repo.ts"

const PLAN = {
  summary: "Fix sum() so the test passes",
  steps: [{ title: "Fix sum", detail: "Return a + b" }],
  files: [{ path: "sum.mjs", reason: "sum subtracts" }],
  risks: [],
}

const FIX_TURN: ProviderTurn = {
  text: "fixing sum",
  toolCalls: [{ id: "call_1", name: "repo_write", arguments: { path: "sum.mjs", content: "export function sum(a, b) {\n  return a + b\n}\n" } }],
}

const FINISH_TURN: ProviderTurn = { text: "done", toolCalls: [{ id: "call_2", name: "finish", arguments: { summary: "fixed" } }] }

function configFor(repo: string, providerConfigured = true): Config {
  return {
    provider: { name: "siliconflow", baseUrl: "http://localhost:1", model: "fake", apiKey: providerConfigured ? "x" : "", configured: providerConfigured },
    repoRoot: repo,
    aiConfigPath: repo + "/.ai-test.json",
    port: 0,
    limits: DEFAULT_LIMITS,
  }
}

let repo: TempRepo
let runtime: Runtime

beforeEach(async () => {
  repo = await createTempRepo()
})

afterEach(async () => {
  await runtime?.waitForAll().catch(() => undefined)
  await repo.cleanup()
})

async function start(provider = new FakeProvider({ plan: PLAN, turns: [FIX_TURN, FINISH_TURN] }), configured = true): Promise<Runtime> {
  runtime = new Runtime({ config: configFor(repo.root, configured), provider })
  await runtime.init()
  return runtime
}

describe("runtime end to end", () => {
  it("plans, waits for approval, then verifies with a real command", async () => {
    await start()
    const created = await runtime.createTask({ title: "Fix sum", summary: "make the test pass", mode: "generate" })
    await runtime.waitForTask(created.id)

    const planned = runtime.getTask(created.id)
    expect(planned.status).toBe("awaiting_approval")
    expect(planned.plan?.checks.map((check) => check.command)).toEqual(["npm run test"])
    // Nothing is written before approval.
    expect(planned.patches).toHaveLength(0)
    await expect(access(join(repo.root, ".repopilot/worktrees", created.id))).rejects.toBeTruthy()

    await runtime.approve(created.id, planned.plan?.hash)
    await runtime.waitForTask(created.id)

    const finished = runtime.getTask(created.id)
    expect(finished.status).toBe("succeeded")
    expect(finished.checks).toHaveLength(1)
    // The terminal event must be durable, otherwise clients never learn the run ended.
    const allEvents = await runtime.events(created.id, 0)
    expect(allEvents.at(-1)?.type).toBe("run.succeeded")
    expect(finished.checks[0]).toMatchObject({ status: "passed", exitCode: 0 })
    expect(finished.checks[0]?.durationMs).toBeGreaterThanOrEqual(0)
    expect(finished.patches).toEqual([{ path: "sum.mjs", kind: "modified", additions: 1, deletions: 1 }])
    expect(finished.report?.baseline).toMatchObject({ passed: 0, failed: 1 })

    // The user's working tree is untouched.
    const userFile = await readFile(join(repo.root, "sum.mjs"), "utf8")
    expect(userFile).toContain("a - b")
  })

  it("fails instead of succeeding when no verification command exists", async () => {
    const bare = await createTempRepo({ files: { "README.md": "# nothing\n" } })
    try {
      runtime = new Runtime({ config: configFor(bare.root), provider: new FakeProvider({ plan: PLAN, turns: [FIX_TURN, FINISH_TURN] }) })
      await runtime.init()
      const created = await runtime.createTask({ title: "Make changes", summary: "", mode: "generate" })
      await runtime.waitForTask(created.id)
      await runtime.approve(created.id, runtime.getTask(created.id).plan?.hash)
      await runtime.waitForTask(created.id)
      const finished = runtime.getTask(created.id)
      expect(finished.status).toBe("failed")
      expect(finished.error?.code).toBe("verification_unavailable")
      expect(finished.report?.unverified.join(" ")).toContain("No verification command")
    } finally {
      await bare.cleanup()
    }
  })

  it("refuses to create a runnable task without a configured provider", async () => {
    await start(new FakeProvider({ plan: PLAN }), false)
    const created = await runtime.createTask({ title: "Blocked", summary: "", mode: "generate" })
    expect(created.status).toBe("blocked")
    expect(created.error?.code).toBe("provider_unconfigured")
    await expect(runtime.approve(created.id)).rejects.toMatchObject({ status: 409 })
  })

  it("fails the task when the model never finishes", async () => {
    const endless = new FakeProvider({
      plan: PLAN,
      turns: Array.from({ length: 40 }, (_, index) => ({ text: "thinking", toolCalls: [{ id: `read_${index}`, name: "repo_read", arguments: { path: "sum.mjs" } }] })),
    })
    runtime = new Runtime({
      config: { ...configFor(repo.root), limits: { ...DEFAULT_LIMITS, maxTurns: 3 } },
      provider: endless,
    })
    await runtime.init()
    const created = await runtime.createTask({ title: "Loop", summary: "", mode: "generate" })
    await runtime.waitForTask(created.id)
    await runtime.approve(created.id, runtime.getTask(created.id).plan?.hash)
    await runtime.waitForTask(created.id)
    const finished = runtime.getTask(created.id)
    expect(finished.status).toBe("failed")
    expect(finished.error?.code).toBe("turns_exhausted")
  })

  it("rejects writes from a read-only review task", async () => {
    const reviewProvider = new FakeProvider({
      plan: { ...PLAN, files: [], steps: [{ title: "Inspect", detail: "" }] },
      turns: [
        { text: "inspecting", toolCalls: [{ id: "r0", name: "repo_read", arguments: { path: "sum.mjs" } }] },
        { text: "trying to write", toolCalls: [{ id: "w1", name: "repo_write", arguments: { path: "sum.mjs", content: "bad" } }] },
        { text: "reporting", toolCalls: [{ id: "r1", name: "report_findings", arguments: { findings: [{ severity: "high", title: "sum is wrong", path: "sum.mjs", line: 2, detail: "subtracts" }] } }] },
        { text: "done", toolCalls: [{ id: "f1", name: "finish", arguments: {} }] },
      ],
    })
    runtime = new Runtime({ config: configFor(repo.root), provider: reviewProvider })
    await runtime.init()
    const created = await runtime.createTask({ title: "Review", summary: "", mode: "review" })
    await runtime.waitForTask(created.id)
    await runtime.approve(created.id, runtime.getTask(created.id).plan?.hash)
    await runtime.waitForTask(created.id)
    const finished = runtime.getTask(created.id)
    expect(finished.status).toBe("succeeded")
    expect(finished.findings).toHaveLength(1)
    expect(finished.patches).toHaveLength(0)
    const events = await runtime.events(created.id, 0)
    const writeAttempt = events.find((event) => event.type === "tool.finished" && (event.payload as { tool?: string }).tool === "repo_write")
    expect(writeAttempt?.payload).toMatchObject({ ok: false })
    expect(await readFile(join(repo.root, "sum.mjs"), "utf8")).toContain("a - b")
  })

  it("re-reads HEAD at approval so a moved repository still gets a valid worktree", async () => {
    await start()
    const created = await runtime.createTask({ title: "Fix sum", summary: "", mode: "generate" })
    await runtime.waitForTask(created.id)

    const { writeFile } = await import("node:fs/promises")
    await writeFile(join(repo.root, "NOTES.md"), "moved-on", "utf8")
    git(repo.root, ["add", "-A"])
    git(repo.root, ["commit", "-q", "--no-verify", "-m", "chore: move HEAD"])
    const newHead = git(repo.root, ["rev-parse", "HEAD"]).trim()

    await runtime.approve(created.id, runtime.getTask(created.id).plan?.hash)
    await runtime.waitForTask(created.id)
    const finished = runtime.getTask(created.id)
    expect(finished.status).toBe("succeeded")
    expect(finished.baseRevision).toBe(newHead)
  })

  it("is idempotent for duplicate approvals", async () => {
    await start()
    const created = await runtime.createTask({ title: "Fix sum", summary: "", mode: "generate" })
    await runtime.waitForTask(created.id)
    const plan = runtime.getTask(created.id).plan
    await runtime.approve(created.id, plan?.hash)
    await expect(runtime.approve(created.id, plan?.hash)).resolves.toBeDefined()
    await runtime.waitForTask(created.id)
    expect(runtime.getTask(created.id).status).toBe("succeeded")
  })

  it("rejects a stale plan hash", async () => {
    await start()
    const created = await runtime.createTask({ title: "Fix sum", summary: "", mode: "generate" })
    await runtime.waitForTask(created.id)
    await expect(runtime.approve(created.id, "deadbeef")).rejects.toMatchObject({ status: 409, code: "stale_plan" })
  })

  it("cancels a run and keeps evidence", async () => {
    await start()
    const created = await runtime.createTask({ title: "Fix sum", summary: "", mode: "generate" })
    await runtime.waitForTask(created.id)
    await runtime.approve(created.id, runtime.getTask(created.id).plan?.hash)
    await runtime.cancel(created.id)
    await runtime.waitForTask(created.id)
    const finished = runtime.getTask(created.id)
    expect(finished.status).toBe("cancelled")
    const events = await runtime.events(created.id, 0)
    expect(events.some((event) => event.type === "run.cancelled")).toBe(true)
  })

  it("undoes to the initial checkpoint", async () => {
    await start()
    const created = await runtime.createTask({ title: "Fix sum", summary: "", mode: "generate" })
    await runtime.waitForTask(created.id)
    await runtime.approve(created.id, runtime.getTask(created.id).plan?.hash)
    await runtime.waitForTask(created.id)
    expect(runtime.getTask(created.id).status).toBe("succeeded")

    const undone = await runtime.undo(created.id, "cp_initial")
    expect(undone.status).toBe("cancelled")
    expect(undone.undoneAt).toBeTruthy()
    expect(undone.patches).toHaveLength(0)
    const worktree = git(repo.root, ["-C", join(repo.root, ".repopilot/worktrees", created.id), "show", "HEAD:sum.mjs"])
    expect(worktree).toContain("a - b")
  })

  it("marks an interrupted run as failed when the store is re-opened", async () => {
    await start()
    const created = await runtime.createTask({ title: "Fix sum", summary: "", mode: "generate" })
    await runtime.waitForTask(created.id)
    const task = runtime.getTask(created.id)
    // Simulate a crash: persist an active status directly, then re-open the store.
    const metaPath = join(repo.root, ".repo-agent", "runs", created.id, "meta.json")
    const raw = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>
    raw.status = "acting"
    const { writeFile } = await import("node:fs/promises")
    await writeFile(metaPath, JSON.stringify(raw), "utf8")

    const reopened = new Runtime({ config: configFor(repo.root), provider: new FakeProvider({ plan: PLAN }) })
    await reopened.init()
    const recovered = reopened.getTask(task.id)
    expect(recovered.status).toBe("failed")
    expect(recovered.error?.code).toBe("interrupted")
  })

  it("surfaces provider failures without claiming success", async () => {
    const failing: import("../../server/core/provider.ts").Provider = {
      name: "fake",
      model: "fake",
      async plan() {
        throw new ProviderError("provider_error", "upstream exploded")
      },
      async chat() {
        throw new ProviderError("provider_error", "upstream exploded")
      },
    }
    runtime = new Runtime({ config: configFor(repo.root), provider: failing })
    await runtime.init()
    const created = await runtime.createTask({ title: "Will fail", summary: "", mode: "generate" })
    await runtime.waitForTask(created.id)
    const finished = runtime.getTask(created.id)
    expect(finished.status).toBe("failed")
    expect(finished.error?.code).toBe("provider_error")
  })
})

describe("repository summary", () => {
  it("detects scripts and language from a real repository", async () => {
    await start()
    const summary = runtime.repoSummary() as RepoSummary
    expect(summary.isGit).toBe(true)
    expect(summary.scripts.test).toBe("node test.mjs")
    expect(summary.languages).toContain("JavaScript")
  })

  it("rejects a directory that is not a Git repository", async () => {
    const { mkdtemp } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const plain = await mkdtemp(join(tmpdir(), "repopilot-plain-"))
    const { rm } = await import("node:fs/promises")
    try {
      const candidate = new Runtime({ config: configFor(plain), provider: new FakeProvider() })
      await candidate.init()
      expect(candidate.repoReady()).toBe(false)
      await expect(candidate.createTask({ title: "x", summary: "", mode: "generate" })).rejects.toMatchObject({ status: 409 })
    } finally {
      await rm(plain, { recursive: true, force: true })
    }
  })
})

describe("provider configuration", () => {
  it("treats env keys as configured and empty env as unconfigured", () => {
    expect(resolveProvider({}).configured).toBe(false)
    expect(resolveProvider({ REPOPILOT_API_KEY: "k" }).configured).toBe(true)
    expect(resolveProvider({ SILICONFLOW_API_KEY: "k" }).configured).toBe(true)
    expect(resolveProvider({ REPOPILOT_PROVIDER: "fake" }).configured).toBe(true)
  })

  it("never reads an API.txt file", async () => {
    const raw = await readFile(join(process.cwd(), "server/core/config.ts"), "utf8")
    expect(raw).not.toContain("API.txt")
  })
})
