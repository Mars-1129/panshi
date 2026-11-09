import test from "node:test"
import assert from "node:assert/strict"
import { routeApproval, nextStatus } from "../src/approval.mjs"

test("50 万以上的应急抢修物资直达分管副总", () => {
  assert.equal(routeApproval({ amountCents: 60_000_000, urgent: true, category: "emergency" }), "vice_president")
})

test("20 万以上由处长审批", () => {
  assert.equal(routeApproval({ amountCents: 25_000_000, urgent: false, category: "normal" }), "director")
})

test("普通采购由经理审批", () => {
  assert.equal(routeApproval({ amountCents: 1_200_000, urgent: false, category: "normal" }), "manager")
})

test("审批通过后进入财务复核", () => {
  assert.equal(nextStatus("draft", "approve"), "pending_finance")
  assert.equal(nextStatus("pending_finance", "approve"), "approved")
})
