import type { z } from "zod"
import type {
  AgentEventSchema,
  ApproveTaskInputSchema,
  CheckSchema,
  CheckpointSchema,
  CreateTaskInputSchema,
  EventTypeSchema,
  FindingSchema,
  FindingSeveritySchema,
  HealthSchema,
  LimitsSchema,
  PatchSchema,
  PlanCheckSchema,
  PlanFileSchema,
  PlanSchema,
  PlanStepSchema,
  RejectTaskInputSchema,
  ReportSchema,
  RepoSummarySchema,
  SetRepoInputSchema,
  TaskModeSchema,
  TaskSchema,
  TaskStatusSchema,
} from "./schemas.ts"

export type TaskMode = z.infer<typeof TaskModeSchema>
export type TaskStatus = z.infer<typeof TaskStatusSchema>
export type EventType = z.infer<typeof EventTypeSchema>
export type AgentEvent = z.infer<typeof AgentEventSchema>
export type PlanStep = z.infer<typeof PlanStepSchema>
export type PlanFile = z.infer<typeof PlanFileSchema>
export type PlanCheck = z.infer<typeof PlanCheckSchema>
export type Plan = z.infer<typeof PlanSchema>
export type Check = z.infer<typeof CheckSchema>
export type Checkpoint = z.infer<typeof CheckpointSchema>
export type Patch = z.infer<typeof PatchSchema>
export type Finding = z.infer<typeof FindingSchema>
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>
export type Report = z.infer<typeof ReportSchema>
export type Task = z.infer<typeof TaskSchema>
export type RepoSummary = z.infer<typeof RepoSummarySchema>
export type Limits = z.infer<typeof LimitsSchema>
export type Health = z.infer<typeof HealthSchema>
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>
export type ApproveTaskInput = z.infer<typeof ApproveTaskInputSchema>
export type RejectTaskInput = z.infer<typeof RejectTaskInputSchema>
export type SetRepoInput = z.infer<typeof SetRepoInputSchema>
