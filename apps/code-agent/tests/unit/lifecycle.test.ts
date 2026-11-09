import { describe, expect, it } from "vitest"
import { InvalidTransitionError, assertTransition, canTransition, isTerminal } from "../../server/core/lifecycle.ts"
import type { TaskStatus } from "../../shared/types.ts"

const ALL: TaskStatus[] = ["queued", "planning", "awaiting_approval", "acting", "verifying", "succeeded", "failed", "cancelled", "blocked"]

describe("task lifecycle", () => {
  it("allows the planned happy path", () => {
    const path: TaskStatus[] = ["planning", "awaiting_approval", "acting", "verifying", "succeeded"]
    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransition(path[index] as TaskStatus, path[index + 1] as TaskStatus)).toBe(true)
    }
  })

  it("allows the repair loop", () => {
    expect(canTransition("verifying", "acting")).toBe(true)
  })

  it("rejects skipping approval", () => {
    expect(canTransition("planning", "acting")).toBe(false)
    expect(() => assertTransition("planning", "acting")).toThrow(InvalidTransitionError)
  })

  it("rejects leaving a terminal state except for undo", () => {
    expect(canTransition("succeeded", "acting")).toBe(false)
    expect(canTransition("succeeded", "cancelled")).toBe(true)
    expect(canTransition("cancelled", "planning")).toBe(false)
  })

  it("cannot succeed without verification", () => {
    expect(canTransition("acting", "succeeded")).toBe(false)
  })

  it("marks terminal states", () => {
    expect(ALL.filter(isTerminal)).toEqual(["succeeded", "failed", "cancelled"])
  })
})
