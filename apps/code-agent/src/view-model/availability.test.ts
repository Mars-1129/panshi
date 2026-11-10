import { describe, expect, it } from "vitest"

import { availabilityFor } from "./availability"

/**
 * availabilityFor 决定一块区域该显示什么状态。
 * 它的顺序很重要：外部不可用 > 阻断 > 失败 > 空 > 就绪。
 * 顺序错了会出现「运行时断线但界面显示空态」这种误导。
 */
describe("availabilityFor · 区域状态判定", () => {
  it("运行时不可达时优先报阻断，而不是空态", () => {
    const result = availabilityFor("blocked", false, false)
    expect(result.kind).toBe("blocked")
    if (result.kind === "blocked") expect(result.reason).toContain("外部依赖")
  })

  it("工段被阻断时给出阻断原因", () => {
    const result = availabilityFor("blocked", true, true)
    expect(result.kind).toBe("blocked")
    if (result.kind === "blocked") expect(result.reason).toContain("护栏")
  })

  it("工段失败时是 error，不是 blocked", () => {
    expect(availabilityFor("failed", true, true).kind).toBe("error")
  })

  it("没有数据时是空态并说明原因", () => {
    const result = availabilityFor("pending", false, true)
    expect(result.kind).toBe("empty")
    if (result.kind === "empty") {
      expect(result.why).toBeTruthy()
      expect(result.next).toBeTruthy()
    }
  })

  it("有数据时是就绪", () => {
    expect(availabilityFor("succeeded", true, true).kind).toBe("ready")
  })

  it("不适用（not_applicable）不当作失败", () => {
    const result = availabilityFor("not_applicable", true, true)
    expect(result.kind).toBe("ready")
  })
})
