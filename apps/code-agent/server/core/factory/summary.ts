import type { FactoryState } from "../../../shared/schemas.ts"

/** 由十工段结果推导工厂运行状态；与 M1 计划审批状态无关。 */
export function summarizeFactory(stages: Array<{ status: string }>): FactoryState | undefined {
  if (stages.length === 0) return undefined
  // not_applicable 的工段（例如仓库里没有黑盒时的工段 03）从分母中排除，
  // 否则任何仓库都永远到不了 100%。
  const skipped = stages.filter((item) => item.status === "not_applicable").length
  const total = Math.max(0, 10 - skipped)
  const done = stages.filter((item) => item.status === "succeeded").length
  const blocked = stages.filter((item) => item.status === "blocked").length
  const failed = stages.filter((item) => item.status === "failed").length
  const runningNow = stages.some((item) => item.status === "running")
  const status = failed > 0
    ? "failed"
    : blocked > 0
      ? "blocked"
      : done >= total
        ? "succeeded"
        : runningNow || done > 0
          ? "running"
          : "not_started"
  return { status, done, total, blocked, updatedAt: new Date().toISOString() }
}
