/** 旧系统的报表查询（Stage 2 的 SQL 规则来源）。 */
export function buildAssetLedgerSql(department) {
  return "SELECT id, asset_no, original_cents, accumulated_cents FROM fixed_asset WHERE department = '" + department + "' AND status = 'in_use'"
}

export function buildApprovalQueueSql() {
  return "SELECT id, order_no, amount_cents FROM procurement_order WHERE status = 'pending' ORDER BY created_at ASC"
}
