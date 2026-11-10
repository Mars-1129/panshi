import { beforeEach, describe, expect, it } from "vitest"

import {
  allStagesDone,
  event,
  repo,
  resetSeq,
  source,
  stageBlocked,
  stageDone,
  stageSkipped,
  task,
} from "./__fixtures__"
import {
  mapAdversarial,
  mapApprovals,
  mapCruise,
  mapDelivery,
  mapRailStats,
  mapRailViolations,
  mapRoles,
  mapSourceLedger,
  mapStageVerdict,
  stageProgress,
  stageStatus,
} from "./mappers"
import { mapAllStages } from "./mappers"

beforeEach(() => {
  resetSeq()
})

describe("stageStatus · 工段状态推导", () => {
  it("没有事件时返回 pending", () => {
    const s = source([])
    expect(stageStatus(s, 5)).toBe("pending")
  })

  it("stage.started 之后是 active", () => {
    const s = source([event("stage.started", 5)])
    expect(stageStatus(s, 5)).toBe("active")
  })

  it("stage.completed 之后是 done", () => {
    const s = source(stageDone(5))
    expect(stageStatus(s, 5)).toBe("done")
  })

  it("blocked 与 failed 分别映射到不同状态", () => {
    expect(stageStatus(source(stageBlocked(3, "no_binary_target", "缺黑盒")), 3)).toBe("blocked")
    expect(stageStatus(source(stageBlocked(3, "equivalence_mismatch", "对拍不一致", "failed")), 3)).toBe("failed")
  })

  it("stage.skipped 映射为 not_applicable，而不是通过或失败", () => {
    const s = source(stageSkipped(3))
    expect(stageStatus(s, 3)).toBe("not_applicable")
  })

  it("后发生的事件覆盖先发生的（重跑后状态跟着变）", () => {
    const s = source([...stageBlocked(3, "no_binary_target", "缺黑盒"), ...stageDone(3)])
    expect(stageStatus(s, 3)).toBe("done")
  })

  it("工段 0 在从未运行但仓库有基线时视为 done", () => {
    const s = source([], { repo: repo({ baseRevision: "abc" }) })
    expect(stageStatus(s, 0)).toBe("done")
  })

  it("工段 0 在没有基线时是 active", () => {
    const s = source([], { repo: repo({ baseRevision: undefined }) })
    expect(stageStatus(s, 0)).toBe("active")
  })
})

describe("stageProgress · 可验证进度", () => {
  it("全部通过是 100%", () => {
    const stages = mapAllStages(source(allStagesDone()), 0)
    expect(stageProgress(stages)).toBe(100)
  })

  it("不适用工段从分母中排除", () => {
    // 9 个通过 + 1 个不适用 → 9/9 = 100%，不能停在 90%
    const events: ReturnType<typeof event>[] = []
    for (let stage = 0; stage <= 9; stage += 1) {
      if (stage === 3) events.push(...stageSkipped(3))
      else events.push(...stageDone(stage))
    }
    const stages = mapAllStages(source(events), 0)
    expect(stageProgress(stages)).toBe(100)
  })

  it("一个阻断时进度不到 100%", () => {
    const events: ReturnType<typeof event>[] = []
    for (let stage = 0; stage <= 9; stage += 1) {
      if (stage === 3) events.push(...stageBlocked(3, "no_binary_target", "缺黑盒"))
      else events.push(...stageDone(stage))
    }
    const stages = mapAllStages(source(events), 0)
    expect(stageProgress(stages)).toBe(90)
  })
})

describe("mapStageVerdict · 工段结论", () => {
  it("工段 0 读 assets 而不是 files", () => {
    const s = source([...stageDone(0), event("baseline.manifest", 0, { assets: 9 })])
    expect(mapStageVerdict(s, 0).conclusion).toContain("9 个文件")
  })

  it("工段 3 有等价结论时报告对拍组数", () => {
    const s = source([
      ...stageDone(3),
      event("decompile.equivalence", 3, { verified: true, cases: 1000, mismatches: 0 }),
    ])
    expect(mapStageVerdict(s, 3).conclusion).toContain("1000")
  })

  it("工段 3 不适用时说明没有黑盒", () => {
    const s = source(stageSkipped(3))
    expect(mapStageVerdict(s, 3).conclusion).toContain("不适用")
  })

  it("工段 3 对拍不一致时报告不一致", () => {
    const s = source([
      ...stageDone(3),
      event("decompile.equivalence", 3, { verified: false, cases: 1000, mismatches: 3 }),
    ])
    expect(mapStageVerdict(s, 3).conclusion).toContain("3")
  })
})

describe("mapRoles · 角色状态", () => {
  it("没有运行数据时角色是 blocked 且预算为 0", () => {
    const roles = mapRoles(source([]))
    expect(roles.length).toBeGreaterThan(0)
    expect(roles.every((role) => role.status === "blocked")).toBe(true)
    expect(roles.every((role) => role.budget.limit === 0)).toBe(true)
  })

  it("有角色运行事件时状态跟着变", () => {
    const events = [
      event("role.run.started", 6, { role: "Backend Builder" }),
      event("role.run.finished", 6, { role: "Backend Builder", status: "succeeded", budgetUsed: 1200, budgetLimit: 20000 }),
    ]
    const roles = mapRoles(source(events))
    const backend = roles.find((role) => role.role === "Backend Builder")
    expect(backend?.status).toBe("done")
    expect(backend?.budget.used).toBe(1200)
  })
})

describe("mapRailViolations · 护栏违规", () => {
  it("只看最近一轮护栏运行，不累计历史", () => {
    const first = [
      event("stage.started", 7),
      event("rail.violation", 7, { railName: "ForbiddenMemoryRail", role: "Judge", reason: "老一轮", expected: "", actual: "", recoveryHint: "" }),
      event("stage.completed", 7),
    ]
    const second = [
      event("stage.started", 7),
      event("rail.violation", 7, { railName: "ContractVerifyRail", role: "Backend Builder", reason: "新一轮", expected: "", actual: "", recoveryHint: "" }),
      event("stage.completed", 7),
    ]
    const violations = mapRailViolations(source([...first, ...second]))
    expect(violations).toHaveLength(1)
    expect(violations[0]?.reason).toBe("新一轮")
  })

  it("审计留痕（severity=warn）与真阻断都保留，但可区分", () => {
    const events = [
      event("stage.started", 7),
      event("rail.violation", 7, { railName: "ForbiddenMemoryRail", role: "Judge", reason: "拦截", expected: "", actual: "", recoveryHint: "", severity: "block" }),
      event("rail.violation", 7, { railName: "AuditRail", role: "Archiver", reason: "本轮检查完成", expected: "", actual: "", recoveryHint: "", severity: "warn" }),
      event("stage.completed", 7),
    ]
    const violations = mapRailViolations(source(events))
    expect(violations.filter((item) => item.severity === "block")).toHaveLength(1)
    expect(violations.filter((item) => item.severity === "warn")).toHaveLength(1)
  })
})

describe("mapDelivery · 交付判定", () => {
  it("没有交付报告时 verified 为 false", () => {
    expect(mapDelivery(source([])).verified).toBe(false)
  })

  it("报告声明 verified 时才为 true", () => {
    const s = source([event("delivery.report", 9, { verified: true, blocked: [], unverified: [] })])
    expect(mapDelivery(s).verified).toBe(true)
  })
})

describe("mapAdversarial / mapCruise / mapApprovals / mapSourceLedger", () => {
  it("没有攻防事件时不编造发现", () => {
    const board = mapAdversarial(source([]))
    expect(board.attacks).toHaveLength(0)
  })

  it("攻防事件按 id 归并", () => {
    const s = source([
      event("stage.started", 8),
      event("attack.finding", 8, { id: "a1", title: "超卖", severity: "critical", status: "open" }),
      event("attack.finding", 8, { id: "a1", title: "超卖", severity: "critical", status: "resolved" }),
    ])
    const board = mapAdversarial(s)
    expect(board.attacks).toHaveLength(1)
    expect(board.attacks[0]?.resolved).toBe(true)
  })

  it("没有巡航事件时 steps 为空", () => {
    expect(mapCruise(source([])).steps).toHaveLength(0)
  })

  it("审批记录来自 approval 事件", () => {
    const s = source([
      event("approval.resolved", 5, { stage: 5, kind: "contract", subject: "锁定契约", decision: "approved", actor: "operator", at: "2026-01-01T00:00:00Z" }),
    ])
    expect(mapApprovals(s)).toHaveLength(1)
  })

  it("没有来源台账时返回 null", () => {
    expect(mapSourceLedger(source([]))).toBeNull()
  })

  it("没有护栏统计时返回 null", () => {
    expect(mapRailStats(source([]))).toBeNull()
  })
})

describe("Fixture 自身的一致性", () => {
  it("allStagesDone 产生十个工段都 done", () => {
    const stages = mapAllStages(source(allStagesDone()), 0)
    expect(stages.filter((stage) => stage.status === "done")).toHaveLength(10)
  })

  it("task 夹具带必要字段", () => {
    expect(task().id).toBe("task_test")
  })
})
