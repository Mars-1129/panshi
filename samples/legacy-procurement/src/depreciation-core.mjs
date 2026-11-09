/**
 * 固定资产折旧核心算法的重写版本。
 *
 * 背景：原开发商把这段算法编译成了动态库（`lib/libdepreciation.wasm` 是它的
 * 等价形态），源码随团队解散丢失。信创改造要求用可维护的 JS 重写它，
 * 并证明重写结果与原库逐值一致——这段代码就是重写的产物。
 *
 * 算法（双倍余额递减法，首个折旧期，整数分）：
 *   1. 使用月数 <= 0 时不做折旧，返回 0
 *   2. 首期折旧 = 成本 × 2 ÷ 使用月数（有符号整数除法，向零截断）
 *   3. 折旧额不得为负
 *   4. 折旧额不得超过「成本 − 残值」
 *
 * 注意：这里的截断方式是**向零截断**（`Math.trunc`），不是向下取整
 * （`Math.floor`）。原库是 C 的 `int` 除法，负数向零截断；早期用
 * `Math.floor` 重写的版本在负数区间会差 1 分，被对拍发现。
 */

/** @param {number} cost 成本（分） @param {number} salvage 残值（分） @param {number} months 使用月数 */
export function monthlyDepreciation(cost, salvage, months) {
  if (!Number.isFinite(cost) || !Number.isFinite(salvage) || !Number.isFinite(months)) return 0
  const c = Math.trunc(cost)
  const s = Math.trunc(salvage)
  const m = Math.trunc(months)
  if (m <= 0) return 0

  let amount = Math.trunc((c * 2) / m)
  if (amount < 0) amount = 0

  const maxDep = c - s
  if (amount > maxDep) amount = maxDep
  if (amount < 0) amount = 0

  return amount
}
