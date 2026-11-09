/**
 * 采购审批路由（旧系统核心规则，Stage 2 会把这些规则连同行号一起抽出来）。
 * 规则来源：2015 版《物资采购管理办法》第十二条。
 */
export function routeApproval({ amountCents, urgent, category }) {
  if (category === "emergency" && amountCents >= 50_000_000 && urgent) {
    return "vice_president"
  }
  if (amountCents >= 20_000_000) {
    return "director"
  }
  if (amountCents > 0) {
    return "manager"
  }
  return "clerk"
}

export function nextStatus(current, decision) {
  if (decision === "reject") return "rejected"
  if (current === "draft" && decision === "approve") return "pending_finance"
  if (current === "pending_finance" && decision === "approve") return "approved"
  return current
}
