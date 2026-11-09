import { describe, expect, it } from "vitest"
import { summarizeFactory } from "../../server/core/factory/summary.ts"

describe("factory summary", () => {
  it("returns undefined before any stage ran", () => {
    expect(summarizeFactory([])).toBeUndefined()
  })

  it("marks a blocked factory when a stage is blocked", () => {
    const stages = [
      ...Array.from({ length: 9 }, () => ({ status: "succeeded" })),
      { status: "blocked" },
    ]
    const summary = summarizeFactory(stages)
    expect(summary?.status).toBe("blocked")
    expect(summary?.done).toBe(9)
    expect(summary?.blocked).toBe(1)
    expect(summary?.total).toBe(10)
  })

  it("marks success only when all ten stages succeeded", () => {
    expect(summarizeFactory(Array.from({ length: 10 }, () => ({ status: "succeeded" })))?.status).toBe("succeeded")
    expect(summarizeFactory(Array.from({ length: 9 }, () => ({ status: "succeeded" })))?.status).toBe("running")
  })

  it("prefers failed over blocked and running", () => {
    expect(summarizeFactory([{ status: "failed" }, { status: "running" }, { status: "blocked" }])?.status).toBe("failed")
  })

  it("excludes not_applicable stages from the denominator", () => {
    // 仓库没有黑盒时工段 03 不适用：9 个通过 + 1 个不适用应当算作成功，
    // 而不是永远停在 90%。
    const stages = [
      ...Array.from({ length: 9 }, () => ({ status: "succeeded" })),
      { status: "not_applicable" },
    ]
    const summary = summarizeFactory(stages)
    expect(summary?.status).toBe("succeeded")
    expect(summary?.total).toBe(9)
    expect(summary?.done).toBe(9)
    expect(summary?.blocked).toBe(0)
  })

  it("keeps the not_applicable stage out of the blocked count", () => {
    const stages = [
      ...Array.from({ length: 8 }, () => ({ status: "succeeded" })),
      { status: "not_applicable" },
      { status: "running" },
    ]
    const summary = summarizeFactory(stages)
    expect(summary?.blocked).toBe(0)
    expect(summary?.status).toBe("running")
  })
})
