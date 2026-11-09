import test from "node:test"
import assert from "node:assert/strict"
import { monthlyDepreciation } from "../src/depreciation.mjs"

// 业务要求：特种设备首月按双倍余额递减法折旧 = 成本 × 2 / 使用月数。
// 当前实现是直线法，这个用例会失败 —— Stage 1 会把它诊断为「测试失败」而不是环境问题。
test("特种设备首月按双倍余额递减法计提", () => {
  assert.equal(monthlyDepreciation(120_000_000, 0, 60), 4_000_000)
})

test("直线法在无残值时仍应等于成本/月数", () => {
  assert.equal(monthlyDepreciation(12_000_000, 0, 60), 200_000)
})
