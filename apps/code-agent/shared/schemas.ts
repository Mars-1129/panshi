import { z } from "zod"
import { FactoryEventTypeSchema } from "./contracts.ts"


export const TaskModeSchema = z.enum(["generate", "fix", "review"])

export const TaskStatusSchema = z.enum([
  "queued",
  "planning",
  "awaiting_approval",
  "acting",
  "verifying",
  "succeeded",
  "failed",
  "cancelled",
  "blocked",
])

const BASE_EVENT_TYPES = [
"task.created",
"plan.ready",
"plan.rejected",
"approval.requested",
"approval.resolved",
"run.queued",
"run.started",
"run.interrupted",
"run.succeeded",
"run.failed",
"run.cancelled",
"checkpoint.created",
"checkpoint.restored",
"tool.started",
"tool.finished",
"patch.created",
"check.started",
"check.finished",
"verification.started",
"provider.error",
"system.note",
] as const

export const EventTypeSchema = z.enum([...BASE_EVENT_TYPES, ...FactoryEventTypeSchema.options] as [string, ...string[]])

export const AgentEventSchema = z.object({
  seq: z.number().int().nonnegative(),
  runId: z.string().min(1),
  taskId: z.string().min(1),
  time: z.string().min(1),
  type: EventTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
})

export const PlanStepStatusSchema = z.enum(["pending", "active", "done"])

export const PlanStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().default(""),
  status: PlanStepStatusSchema.default("pending"),
})

export const PlanFileSchema = z.object({
  path: z.string().min(1),
  reason: z.string().default(""),
})

export const PlanCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  command: z.string().min(1),
  required: z.boolean().default(true),
})

export const PlanSchema = z.object({
  version: z.number().int().positive(),
  hash: z.string().min(1),
  summary: z.string(),
  steps: z.array(PlanStepSchema),
  files: z.array(PlanFileSchema),
  checks: z.array(PlanCheckSchema),
  risks: z.array(z.string()).default([]),
})

export const CheckStatusSchema = z.enum(["queued", "running", "passed", "failed", "skipped"])

export const CheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  command: z.string().min(1),
  status: CheckStatusSchema,
  required: z.boolean().default(true),
  exitCode: z.number().int().nullable().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  timedOut: z.boolean().optional(),
  reason: z.string().optional(),
})

export const PatchKindSchema = z.enum(["added", "modified", "deleted"])

export const PatchSchema = z.object({
  path: z.string().min(1),
  oldPath: z.string().optional(),
  kind: PatchKindSchema,
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  baseHash: z.string().optional(),
})

export const FindingSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"])

export const FindingSchema = z.object({
  id: z.string().min(1),
  severity: FindingSeveritySchema,
  title: z.string().min(1),
  path: z.string().min(1),
  line: z.number().int().nonnegative(),
  detail: z.string(),
  status: z.enum(["open", "resolved"]).default("open"),
})

export const ReportSchema = z.object({
  summary: z.string(),
  changedFiles: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  checks: z.object({
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
  baseline: z
    .object({
      total: z.number().int().nonnegative(),
      passed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
    })
    .optional(),
  risks: z.array(z.string()),
  unverified: z.array(z.string()),
  generatedAt: z.string(),
})

export const TaskErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
})

export const CheckpointSchema = z.object({
  id: z.string().min(1),
  commit: z.string().min(1),
  message: z.string(),
  createdAt: z.string().min(1),
})

export const FactoryStateSchema = z.object({
  status: z.enum(["not_started", "running", "blocked", "failed", "succeeded"]),
  done: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  blocked: z.number().int().nonnegative(),
  updatedAt: z.string(),
})
export type FactoryState = z.infer<typeof FactoryStateSchema>

export const TaskSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  mode: TaskModeSchema,
  status: TaskStatusSchema,
  repo: z.string(),
  baseRevision: z.string().optional(),
  branch: z.string(),
  worktree: z.string(),
  plan: PlanSchema.nullable().optional(),
  patches: z.array(PatchSchema).default([]),
  checks: z.array(CheckSchema).default([]),
  findings: z.array(FindingSchema).default([]),
  checkpoints: z.array(CheckpointSchema).default([]),
  report: ReportSchema.nullable().optional(),
  error: TaskErrorSchema.nullable().optional(),
  undoneAt: z.string().optional(),
  factory: FactoryStateSchema.optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  version: z.number().int().nonnegative().default(0),
})

export const RepoSummarySchema = z.object({
  root: z.string(),
  name: z.string(),
  isGit: z.boolean(),
  baseRevision: z.string().optional(),
  languages: z.array(z.string()),
  packageManager: z.string(),
  scripts: z.record(z.string(), z.string()),
  entrypoints: z.array(z.string()),
  hasUncommittedChanges: z.boolean(),
})

export const LimitsSchema = z.object({
  maxTurns: z.number().int().positive(),
  maxWrites: z.number().int().positive(),
  maxRepairLoops: z.number().int().nonnegative(),
  maxWallMs: z.number().int().positive(),
  commandTimeoutMs: z.number().int().positive(),
  maxOutputBytes: z.number().int().positive(),
  maxDiffBytes: z.number().int().positive(),
})

export const HealthSchema = z.object({
  ok: z.boolean(),
  provider: z.string(),
  model: z.string(),
  configured: z.boolean(),
  repo: z.string(),
  repoReady: z.boolean().default(true),
  repoError: z.string().nullable().optional(),
  limits: LimitsSchema,
  version: z.string(),
})

export const CreateTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(4000).default(""),
  mode: TaskModeSchema,
  repo: z.string().trim().min(1).optional(),
})

export const ApproveTaskInputSchema = z.object({
  planHash: z.string().min(1).optional(),
})

export const RejectTaskInputSchema = z.object({
  reason: z.string().trim().max(1000).default(""),
})

export const ProjectDraftSchema = z.object({
  product: z.string().trim().min(1).max(80),
  description: z.string().max(240).optional(),
  entities: z.array(z.object({
    table: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().max(40).optional(),
    fields: z.array(z.object({ name: z.string().regex(/^[a-z][a-z0-9_]*$/), type: z.string().min(1) })).min(1).max(12),
  })).min(1).max(4),
})

export const SetRepoInputSchema = z.object({
  path: z.string().trim().min(1),
})

export const TaskListSchema = z.object({
  tasks: z.array(TaskSchema),
})

export const EventListSchema = z.object({
  events: z.array(AgentEventSchema),
})

export const PatchListSchema = z.object({
  patches: z.array(PatchSchema),
  diff: z.record(z.string(), z.string()),
  truncated: z.boolean().default(false),
})
