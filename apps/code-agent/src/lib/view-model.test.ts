import { beforeEach, describe, expect, it } from "vitest"

import { event, resetSeq } from "../view-model/__fixtures__"
import { mergeEvents } from "./view-model"

beforeEach(() => {
  resetSeq()
})

describe("mergeEvents · SSE 增量与快照合并", () => {
  it("按 seq 去重：同一条事件不会出现两次", () => {
    const a = event("stage.started", 1)
    const merged = mergeEvents([a], [a])
    expect(merged).toHaveLength(1)
  })

  it("按 seq 升序排列，即使输入是乱序的", () => {
    const e1 = event("stage.started", 1)
    const e2 = event("stage.completed", 1)
    const e3 = event("stage.started", 2)
    const merged = mergeEvents([e3], [e1, e2])
    expect(merged.map((item) => item.seq)).toEqual([e1.seq, e2.seq, e3.seq])
  })

  it("同 seq 时后到的覆盖先到的（快照修正实时事件）", () => {
    const live = event("stage.started", 1)
    const snapshot = { ...live, payload: { stageId: 1, corrected: true } }
    const merged = mergeEvents([live], [snapshot])
    expect(merged).toHaveLength(1)
    expect((merged[0]?.payload as Record<string, unknown>).corrected).toBe(true)
  })

  it("空输入不会崩", () => {
    expect(mergeEvents([], [])).toEqual([])
  })

  it("合并结果不修改入参数组", () => {
    const current = [event("stage.started", 1)]
    const incoming = [event("stage.completed", 1)]
    const before = current.length
    mergeEvents(current, incoming)
    expect(current).toHaveLength(before)
  })
})
