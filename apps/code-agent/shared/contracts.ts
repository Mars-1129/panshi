import { z } from "zod"

/** 0–9 十个工段。 */
export const StageIdSchema = z.number().int().min(0).max(9)
export type StageId = z.infer<typeof StageIdSchema>

/**
 * not_applicable：本仓库没有该工段适用的对象（例如没有黑盒时的工段 03）。
 * 它不是失败——不计入进度分母，也不让交付判定变成未通过。
 */
export const StageStatusSchema = z.enum(["pending", "running", "succeeded", "failed", "blocked", "not_applicable"])

export const RoleNameSchema = z.enum([
  "Chief Architect",
  "Contract Builder",
  "Database Builder",
  "Backend Builder",
  "Frontend Builder",
  "Seed Data Builder",
  "Skill Integrator",
  "Judge",
  "Red Agent",
  "Blue Agent",
  "Visual Agent",
  "Archiver",
])

export type ArtifactKind = z.infer<typeof ArtifactKindSchema>

export const ArtifactKindSchema = z.enum(["schema", "openapi", "component-tree", "report", "code", "skillpack", "evidence", "other"])

export const ArtifactSchema = z.object({
  artifactId: z.string().min(1),
  taskId: z.string().min(1),
  stage: StageIdSchema,
  name: z.string().min(1),
  kind: ArtifactKindSchema,
  hash: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  path: z.string().min(1),
  producedBy: z.string().min(1).default("stage-runner"),
  createdAt: z.string().min(1),
})
export type Artifact = z.infer<typeof ArtifactSchema>

export const FailureSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  at: z.string().min(1),
})

export const StageRunSchema = z.object({
  stageRunId: z.string().min(1),
  taskId: z.string().min(1),
  stage: StageIdSchema,
  status: StageStatusSchema,
  startedAt: z.string().min(1),
  finishedAt: z.string().optional(),
  failure: FailureSchema.optional(),
  artifacts: z.array(ArtifactSchema).default([]),
  notes: z.array(z.string()).default([]),
})
export type StageRun = z.infer<typeof StageRunSchema>

/** 输入资产：Stage 0 的 ProjectManifest 主体。 */
export const AssetSchema = z.object({
  path: z.string(),
  hash: z.string(),
  bytes: z.number().int().nonnegative(),
})

export const ProjectManifestSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  root: z.string().min(1),
  assets: z.array(AssetSchema),
  baseRevision: z.string().optional(),
  createdAt: z.string().min(1),
})
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>

export const SecretFindingSchema = z.object({
  path: z.string(),
  line: z.number().int().nonnegative(),
  kind: z.string(),
  masked: z.string(),
})

export const SecretScanReportSchema = z.object({
  scannedFiles: z.number().int().nonnegative(),
  findings: z.array(SecretFindingSchema),
  skipped: z.array(z.string()).default([]),
})
export type SecretScanReport = z.infer<typeof SecretScanReportSchema>

export const EnvironmentSummarySchema = z.object({
  packageManager: z.string(),
  languages: z.array(z.string()),
  entrypoints: z.array(z.string()),
  scripts: z.record(z.string(), z.string()),
  node: z.string(),
  platform: z.string(),
})

export const BuildDiagnosisSchema = z.object({
  command: z.string(),
  exitCode: z.number().int().nullable(),
  classification: z.enum(["ok", "dependency", "toolchain", "test", "implementation", "timeout", "unknown"]),
  logPath: z.string(),
  stderrTail: z.string().default(""),
})

export const BusinessRuleSchema = z.object({
  ruleId: z.string(),
  path: z.string(),
  line: z.number().int().nonnegative(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  kind: z.enum(["threshold", "branch", "state", "sql", "other"]),
})
export type BusinessRule = z.infer<typeof BusinessRuleSchema>

export const RailViolationSchema = z.object({
  railName: z.string(),
  role: z.string(),
  tool: z.string().optional(),
  file: z.string().optional(),
  line: z.number().int().optional(),
  reason: z.string(),
  expected: z.string(),
  actual: z.string(),
  contractHash: z.string().default("pending"),
  recoveryHint: z.string(),
  severity: z.enum(["block", "warn"]).default("block"),
})
export type RailViolation = z.infer<typeof RailViolationSchema>

export const ContractKindSchema = z.enum(["schema.sql", "openapi.yaml", "component_tree.json"])
export type ContractKind = z.infer<typeof ContractKindSchema>

export const ContractBundleSchema = z.object({
  version: z.number().int().positive(),
  hash: z.string().min(1),
  kinds: z.array(ContractKindSchema),
  locked: z.boolean().default(false),
  contents: z.record(z.string(), z.string()).default({}),
  validation: z.array(z.object({ kind: ContractKindSchema, ok: z.boolean(), errors: z.array(z.string()) })).default([]),
  lockedAt: z.string().optional(),
})
export type ContractBundle = z.infer<typeof ContractBundleSchema>

export const DeliveryReportSchema = z.object({
  runId: z.string(),
  generatedAt: z.string(),
  stages: z.array(z.object({ stage: StageIdSchema, status: StageStatusSchema, durationMs: z.number().nonnegative() })),
  stats: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })),
  evidence: z.array(z.object({ seq: z.number().int(), type: z.string(), ref: z.string() })),
  blocked: z.array(z.string()),
  unverified: z.array(z.string()),
  verified: z.boolean(),
})
export type DeliveryReport = z.infer<typeof DeliveryReportSchema>

/** 新增事件类型（与 existing EventTypeSchema 合并使用）。 */
export const FactoryEventTypeSchema = z.enum([
  "stage.started",
  "stage.completed",
  "stage.failed",
  "stage.skipped",
  "artifact.created",
  "baseline.manifest",
  "baseline.secretScan",
  "baseline.environment",
  "greenbuild.diagnosis",
  "greenbuild.conflicts",
  "greenbuild.verdict",
  "archaeology.slice",
  "archaeology.rule",
  "archaeology.unanalyzed",
  "decompile.symbols",
  "decompile.diff",
  "decompile.equivalence",
  "skill.build",
  "skill.harness",
  "skill.license",
  "skill.register",
  "clarify.message",
  "contract.validate",
  "contract.locked",
  "role.run.started",
  "role.run.finished",
  "role.merge",
  "rail.violation",
  "attack.finding",
  "judge.invariant",
  "cruise.step",
  "cruise.error",
  "cruise.replay",
  "delivery.report",
  "prototype.ready",
  "approval.requested",
  "approval.resolved",
  "rail.stats",
  "judge.permission",
  "source.ledger",
  "rsi.evolution",
])
export type FactoryEventType = z.infer<typeof FactoryEventTypeSchema>

export const ProjectName = "PanShi-SwarmFactory"
