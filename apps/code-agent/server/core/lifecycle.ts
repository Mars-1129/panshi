import type { TaskStatus } from "../../shared/types.ts"

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ["acting", "cancelled", "failed"],
  planning: ["awaiting_approval", "blocked", "failed", "cancelled"],
  awaiting_approval: ["acting", "planning", "cancelled", "failed"],
  acting: ["verifying", "failed", "cancelled"],
  verifying: ["succeeded", "failed", "cancelled", "acting"],
  blocked: ["planning", "cancelled"],
  succeeded: ["cancelled"],
  failed: ["cancelled"],
  cancelled: [],
}

export class InvalidTransitionError extends Error {
  readonly from: TaskStatus
  readonly to: TaskStatus

  constructor(from: TaskStatus, to: TaskStatus) {
    super(`Invalid task transition: ${from} -> ${to}`)
    this.name = "InvalidTransitionError"
    this.from = from
    this.to = to
  }
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to)
}

export const TERMINAL_STATUSES: TaskStatus[] = ["succeeded", "failed", "cancelled"]

export function isTerminal(status: TaskStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}
