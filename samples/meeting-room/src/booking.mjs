/**
 * 会议室预约规则（新建项目的初始业务代码，Stage 2 会把这些规则连同行号抽出来）。
 * 规则来源：《会议室管理办法（试行）》第六、九条。
 */
export function approvalLevel(capacity, external) {
  if (external && capacity >= 20) return "director"
  if (capacity >= 8) return "manager"
  return "auto"
}

export function canReserve(room, startAt, endAt) {
  if (room.status !== "available") return false
  if (room.capacity <= 0) return false
  if (startAt >= endAt) return false
  return true
}

export function slotKey(date, hour) {
  return `${date}#${String(hour).padStart(2, "0")}`
}
