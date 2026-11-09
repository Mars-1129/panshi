import { describe, expect, it } from "vitest"
import { availabilityFor } from "../../src/view-model/availability"
import { mapAllStages, mapDelivery, mapRoles } from "../../src/view-model/mappers"
import type { FactorySource } from "../../src/view-model/factory-types"

const source: FactorySource = {
  task: null,
  events: [],
  repo: {
    root: "/workspace/demo",
    name: "demo",
    isGit: true,
    baseRevision: "abc123",
    languages: ["TypeScript"],
    packageManager: "pnpm",
    scripts: {},
    entrypoints: [],
    hasUncommittedChanges: false,
  },
  runtimeReachable: true,
}

describe("factory view model", () => {
  it("always exposes the ten ordered stages without inventing downstream data", () => {
    const stages = mapAllStages(source, 0)
    expect(stages).toHaveLength(10)
    expect(stages.map((stage) => stage.stage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(stages[0].status).toBe("pending")
    expect(stages[1].status).toBe("pending")
    expect(stages[1].outputs).toEqual([])
  })

  it("keeps all twelve roles explicit and honest when backend role data is absent", () => {
    const roles = mapRoles(source)
    expect(roles).toHaveLength(12)
    expect(roles.every((role) => role.status === "blocked")).toBe(true)
    expect(roles.every((role) => role.meta?.includes("尚未接入"))).toBe(true)
  })

  it("represents an unavailable external dependency as blocked", () => {
    expect(availabilityFor(undefined, false, false)).toEqual({
      kind: "blocked",
      reason: "外部依赖不可用",
      recoveryHint: "检查运行时连接后重试",
    })
  })

  it("does not mark a delivery report verified without evidence", () => {
    const report = mapDelivery(source)
    expect(report.verified).toBe(false)
    expect(report.stats.some((item) => item.label === "未验证项")).toBe(true)
  })
})
