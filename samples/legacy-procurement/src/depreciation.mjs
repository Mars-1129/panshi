/**
 * 固定资产折旧（旧系统实现）。
 * 业务要求：特种设备使用「双倍余额递减法」，首月折旧 = 成本 × 2 / 使用月数。
 * 当前实现是直线法，且没有下限保护 —— 已知缺陷，见 test/depreciation.test.mjs。
 */
export function monthlyDepreciation(costCents, salvageCents, months) {
  if (months <= 0) return 0
  return Math.floor((costCents - salvageCents) / months)
}

/** 双倍余额递减法：仅用于验收对照，旧系统尚未启用。 */
export function doubleDeclining(costCents, months) {
  if (months <= 0) return 0
  return Math.floor((costCents * 2) / months)
}
