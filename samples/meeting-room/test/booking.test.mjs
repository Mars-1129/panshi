import test from "node:test"
import assert from "node:assert/strict"
import { approvalLevel, canReserve, slotKey } from "../src/booking.mjs"

const room = { status: "available", capacity: 12 }

test("20 人以上外部会议需要分管领导审批", () => {
  assert.equal(approvalLevel(24, true), "director")
})

test("8 人以上需要部门经理审批", () => {
  assert.equal(approvalLevel(10, false), "manager")
})

test("可用会议室在合法时段可以预约", () => {
  assert.equal(canReserve(room, 9, 11), true)
})

test("结束时间必须晚于开始时间", () => {
  assert.equal(canReserve(room, 11, 11), false)
})

test("时段键按小时补零", () => {
  assert.equal(slotKey("2026-11-07", 9), "2026-11-07#09")
})
