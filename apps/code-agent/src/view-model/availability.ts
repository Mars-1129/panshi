import type { FailureDetail } from "./factory-types"

export type ViewAvailability =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "empty"; why: string; next: string }
  | { kind: "blocked"; reason: string; recoveryHint: string }
  | { kind: "error"; failure: FailureDetail }

export function availabilityFor(
  status: string | undefined,
  hasData: boolean,
  externalReachable: boolean,
): ViewAvailability {
  if (!externalReachable) {
    return { kind: "blocked", reason: "外部依赖不可用", recoveryHint: "检查运行时连接后重试" }
  }
  if (status === "blocked") {
    return { kind: "blocked", reason: "工段被护栏阻断", recoveryHint: "查看阻断证据并处理" }
  }
  if (status === "failed") {
    return { kind: "error", failure: { reason: "工段执行失败", occurredAt: new Date(0).toISOString() } }
  }
  if (!hasData) {
    return { kind: "empty", why: "该工段尚未接入后端数据", next: "等待对应工段完成后再显示产物" }
  }
  return { kind: "ready" }
}
