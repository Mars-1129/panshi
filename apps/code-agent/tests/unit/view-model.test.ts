import { describe, expect, it } from "vitest"
import { mergeEvents, parseUnifiedDiff, toTaskView, toUiEvent } from "../../src/lib/view-model.ts"
import type { AgentEvent, Task as ServerTask } from "../../shared/types.ts"

function event(seq: number, type: AgentEvent["type"], payload: Record<string, unknown> = {}): AgentEvent {
  return { seq, runId: "run_1", taskId: "task_1", time: new Date(2026, 0, 1, 12, 0, seq).toISOString(), type, payload }
}

function serverTask(overrides: Partial<ServerTask> = {}): ServerTask {
  return {
    id: "task_1",
    runId: "run_1",
    title: "Fix it",
    summary: "",
    mode: "generate",
    status: "succeeded",
    repo: "/tmp/repo",
    branch: "rp/task_1",
    worktree: "/tmp/repo/.repopilot/worktrees/task_1",
    plan: {
      version: 1,
      hash: "abc",
      summary: "fix",
      steps: [{ id: "step_1", title: "A", detail: "", status: "pending" }],
      files: [],
      checks: [],
      risks: [],
    },
    patches: [{ path: "a.ts", kind: "modified", additions: 1, deletions: 1 }],
    checks: [],
    findings: [],
    checkpoints: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 3,
    ...overrides,
  }
}

describe("mergeEvents", () => {
  it("dedupes by seq and keeps ascending order", () => {
    const merged = mergeEvents([event(2, "plan.ready"), event(1, "task.created")], [event(2, "plan.ready"), event(3, "run.started")])
    expect(merged.map((item) => item.seq)).toEqual([1, 2, 3])
  })

  it("does not let an out-of-order replay duplicate an event", () => {
    const merged = mergeEvents([event(1, "task.created"), event(5, "run.started")], [event(3, "plan.ready")])
    expect(merged).toHaveLength(3)
    expect(new Set(merged.map((item) => item.seq)).size).toBe(3)
  })
})

describe("toTaskView", () => {
  it("derives files and plan steps without fabricating values", () => {
    const view = toTaskView(serverTask(), {})
    expect(view.files).toEqual([{ path: "a.ts", kind: "modified", additions: 1, deletions: 1, verified: true }])
    expect(view.planSteps[0]?.status).toBe("done")
    expect(view.checks).toEqual([])
    expect(view.findings).toEqual([])
  })

  it("shows an honest empty diff map when no diff was loaded", () => {
    const view = toTaskView(serverTask(), {})
    expect(view.diff).toEqual({})
    expect(view.currentFile).toBe("a.ts")
  })
})

describe("toUiEvent", () => {
  it("renders real check exit codes", () => {
    const ui = toUiEvent(event(4, "check.finished", { label: "Tests", status: "failed", exitCode: 1, durationMs: 321 }))
    expect(ui.detail).toContain("exit=1")
    expect(ui.detail).toContain("321ms")
    expect(ui.tone).toBe("danger")
  })

  it("marks passed checks as ok", () => {
    expect(toUiEvent(event(5, "check.finished", { status: "passed" })).tone).toBe("ok")
  })
})

describe("parseUnifiedDiff", () => {
  it("tracks old and new line numbers", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -3,3 +3,3 @@",
      " context",
      "-old",
      "+new",
      " tail",
    ].join("\n")
    const lines = parseUnifiedDiff(diff)
    const removed = lines.find((line) => line.kind === "remove")
    const added = lines.find((line) => line.kind === "add")
    expect(removed?.oldLine).toBe(4)
    expect(added?.newLine).toBe(4)
  })

  it("returns an empty list for an empty diff", () => {
    expect(parseUnifiedDiff("")).toHaveLength(1)
  })
})
