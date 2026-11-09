import type {
  AgentEvent,
  Check,
  Checkpoint,
  Finding,
  Health,
  Plan,
  PlanStep,
  Report,
  RepoSummary,
  Task as ServerTask,
  TaskMode,
  TaskStatus,
} from "../shared/types.ts"

export type Theme = "light" | "dark"
export type NavView = "workspace" | "templates" | "settings"
export type TaskTab = "overview" | "plan" | "run" | "changes" | "checks" | "review"
export type EventTone = "neutral" | "accent" | "ok" | "warn" | "danger" | "info"
export type EventKind = "system" | "tool" | "command" | "check" | "approval"

export type { AgentEvent, Check, Checkpoint, Finding, Health, Plan, PlanStep, Report, RepoSummary, ServerTask, TaskMode, TaskStatus }

export type UiEvent = {
  seq: number
  time: string
  title: string
  detail: string
  tone: EventTone
  kind: EventKind
  turn?: number
}

export type ChangedFile = {
  path: string
  kind: "added" | "modified" | "deleted"
  additions: number
  deletions: number
  verified: boolean
}

export type DiffLine = {
  kind: "add" | "remove" | "context" | "header"
  text: string
  oldLine?: number
  newLine?: number
}

export type Task = {
  id: string
  runId: string
  title: string
  summary: string
  mode: TaskMode
  status: TaskStatus
  branch: string
  worktree: string
  repo: string
  createdAt: string
  updatedAt: string
  plan: Plan | null
  planSteps: PlanStep[]
  events: UiEvent[]
  checks: Check[]
  files: ChangedFile[]
  findings: Finding[]
  diff: Record<string, string>
  report: Report | null
  error: { code: string; message: string } | null
  checkpoints: Checkpoint[]
  undoneAt?: string
  currentFile: string
}

export type RuntimeMode = "connecting" | "live" | "offline"
export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline" | "snapshot"
