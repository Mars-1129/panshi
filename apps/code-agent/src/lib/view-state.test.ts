import { describe, expect, it } from "vitest"

import { DEFAULT_VIEW, formatViewHash, parseViewHash } from "./view-state"

describe("parseViewHash · 地址栏还原视图", () => {
  it("认得出工段深链", () => {
    expect(parseViewHash("#/stage/8")).toEqual({ view: "stage", stage: 8 })
    expect(parseViewHash("#/stage/0")).toEqual({ view: "stage", stage: 0 })
  })

  it("接受不带 # 的写法", () => {
    expect(parseViewHash("/stage/3")).toEqual({ view: "stage", stage: 3 })
  })

  it("空 hash 回概览", () => {
    expect(parseViewHash("")).toEqual(DEFAULT_VIEW)
  })

  it("手改出的非法工段号回概览，不抛错", () => {
    expect(parseViewHash("#/stage/99")).toEqual(DEFAULT_VIEW)
    expect(parseViewHash("#/stage/abc")).toEqual(DEFAULT_VIEW)
    expect(parseViewHash("#/nonsense")).toEqual(DEFAULT_VIEW)
  })

  it("多位数不当作工段（只有 0-9）", () => {
    expect(parseViewHash("#/stage/12")).toEqual(DEFAULT_VIEW)
  })
})

describe("formatViewHash · 视图编码成地址", () => {
  it("概览不写 hash，保持地址干净", () => {
    expect(formatViewHash({ view: "overview" })).toBe("")
  })

  it("工段写出 hash", () => {
    expect(formatViewHash({ view: "stage", stage: 5 })).toBe("#/stage/5")
  })

  it("往返一致", () => {
    for (let stage = 0; stage <= 9; stage += 1) {
      const state = { view: "stage" as const, stage }
      expect(parseViewHash(formatViewHash(state))).toEqual(state)
    }
  })
})
