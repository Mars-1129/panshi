import type { AgentEvent, RepoSummary, ServerTask } from "../types"
import {
  ANCHOR_ORDER,
  ROLE_ORDER,
  STAGES,
  STAGE_ORDER,
  type AdversarialBoard,
  type ArtifactRef,
  type AttackFinding,
  type ContractView,
  type CruiseView,
  type DeliveryReport,
  type EvidenceItem,
  type FactorySource,
  type ApprovalRecord,
  type PermissionCheck,
  type PermissionView,
  type PrototypeAnchorView,
  type StageVerdict,
  type PrototypeEntityView,
  type PrototypeView,
  type RailName,
  type RailStatsView,
  type SourceEntry,
  type SourceLedgerView,
  type RailViolation,
  type RoleName,
  type RoleView,
  type StageId,
  type StageStatus,
  type StageView,
} from "./factory-types"

const EMPTY_BUDGET = { used: 0, limit: 0, paused: false }

const EXIT_CRITERIA: Record<StageId, string> = {
  0: "输入资产有哈希，基线 revision 可复现。",
  1: "旧项目完成一次受限构建尝试并保存诊断。",
  2: "业务规则带来源位置，动态未分析项已列出。",
  3: "目标函数完成反编译并通过差分样本。",
  4: "SkillPack 通过 Harness 并完成来源登记。",
  5: "用户确认原型，三份契约生成并锁定。",
  6: "Database/Backend/Frontend 角色真实并发完成。",
  7: "访问、契约、预算和敏感信息规则均有证据。",
  8: "攻击、裁判、修复和浏览器巡航有闭环证据。",
  9: "交付报告可回溯，经验已沉淀为 SkillPack。",
}

const RAIL_NAMES = new Set<string>(["ForbiddenMemoryRail", "ContextRedactionRail", "PermissionInterruptRail", "ContractVerifyRail", "CodingMemoryRail", "BudgetRail", "AuditRail"])
const ROLE_NAMES = new Set<string>(ROLE_ORDER.map((item) => item.role))
const ARTIFACT_KINDS = new Set(["schema", "openapi", "component-tree", "report", "code", "skillpack", "evidence", "other"])

function payload(event: AgentEvent): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>
}

function stageNumberOf(event: AgentEvent): number | null {
  const raw = payload(event).stageId ?? payload(event).stage
  const value = typeof raw === "number" ? raw : Number(raw)
  return Number.isInteger(value) && value >= 0 && value <= 9 ? value : null
}

/** 从真实事件推导工段状态：后发生的事件覆盖先发生的。 */
export function stageStatus(source: FactorySource, stage: StageId): StageStatus {
  for (let index = source.events.length - 1; index >= 0; index -= 1) {
    const event = source.events[index]
    if (!event || stageNumberOf(event) !== stage) continue
    if (event.type === "stage.failed") {
      const status = String(payload(event).status ?? "failed")
      if (status === "blocked") return "blocked"
      // 老版本把「不适用」写成 failed + status=not_applicable，这里兼容识别
      if (status === "not_applicable") return "not_applicable"
      return "failed"
    }
    if (event.type === "stage.skipped") return "not_applicable"
    if (event.type === "stage.completed") return "done"
    if (event.type === "stage.started") return "active"
  }
  if (stage === 0) {
    if (!source.task) return source.runtimeReachable ? "pending" : "blocked"
    return source.repo?.baseRevision ? "done" : source.runtimeReachable ? "active" : "blocked"
  }
  if (stage === 6 && source.task) {
    if (source.task.status === "failed") return "failed"
    if (source.task.status === "acting" || source.task.status === "verifying") return "active"
  }
  return "pending"
}

/** 某工段的产物（来自 artifact.created 事件）。 */
function artifactsFor(source: FactorySource, stage: StageId): ArtifactRef[] {
  const seen = new Set<string>()
  const startSeq = latestStageStartSeq(source, stage)
  const out: ArtifactRef[] = []
  for (const event of source.events) {
    if (event.type !== "artifact.created") continue
    if (startSeq !== null && event.seq < startSeq) continue
    const data = payload(event)
    if (stageNumberOf(event) !== stage) continue
    const artifactId = String(data.artifactId ?? "")
    if (!artifactId || seen.has(artifactId)) continue
    seen.add(artifactId)
    const kindRaw = String(data.kind ?? "other")
    out.push({
      artifactId,
      name: String(data.name ?? artifactId),
      kind: (ARTIFACT_KINDS.has(kindRaw) ? kindRaw : "other") as ArtifactRef["kind"],
      hash: typeof data.hash === "string" ? data.hash : undefined,
      state: "output",
    })
  }
  return out
}

export function mapStage(stage: StageId, source: FactorySource, selected: boolean): StageView {
  const definition = STAGES.find((item) => item.id === stage)
  const status = stageStatus(source, stage)
  const outputs = artifactsFor(source, stage)
  return {
    stage,
    name: definition?.name ?? "工段",
    sub: definition?.sub ?? "",
    status,
    selected,
    exitCriteria: EXIT_CRITERIA[stage],
    inputs: [],
    outputs,
    overallPercent: status === "done" ? 100 : status === "active" ? 50 : 0,
  }
}

export function mapAllStages(source: FactorySource, selected: StageId): StageView[] {
  return STAGE_ORDER.map((stage) => mapStage(stage, source, stage === selected))
}

export function mapRoles(source: FactorySource): RoleView[] {
  const runs = new Map<string, { status: string; budgetUsed: number; budgetLimit: number; workspace: string; bytes: number }>()
  for (const event of source.events) {
    if (event.type !== "role.run.started" && event.type !== "role.run.finished") continue
    const data = payload(event)
    const role = String(data.role ?? "")
    if (!role) continue
    const previous = runs.get(role)
    runs.set(role, {
      status: event.type === "role.run.started" ? "running" : String(data.status ?? "succeeded"),
      budgetUsed: Number(data.budgetUsed ?? previous?.budgetUsed ?? 0),
      budgetLimit: Number(data.budgetLimit ?? previous?.budgetLimit ?? 0),
      workspace: String(data.workspace ?? previous?.workspace ?? ""),
      bytes: Number(data.bytes ?? previous?.bytes ?? 0),
    })
  }

  return ROLE_ORDER.map((definition) => {
    const run = runs.get(definition.role)
    const status: RoleView["status"] = !run
      ? "blocked"
      : run.status === "running"
        ? "running"
        : run.status === "failed"
          ? "failed"
          : run.status === "blocked"
            ? "blocked"
            : "done"
    return {
      role: definition.role,
      short: definition.short,
      status,
      budget: run ? { used: run.budgetUsed, limit: run.budgetLimit, paused: false } : EMPTY_BUDGET,
      stage: definition.stage,
      concurrent: run?.status === "running",
      meta: run ? `${run.workspace}${run.bytes ? ` · ${run.bytes} bytes` : ""}` : "后端角色数据尚未接入，当前仅展示角色合同与诚实阻断态",
    }
  })
}

export function mapContracts(): ContractView[] {
  return []
}

export function mapRailViolations(source: FactorySource): RailViolation[] {
  const out: RailViolation[] = []
  for (const event of source.events) {
    if (event.type !== "rail.violation") continue
    // 只认最近一次工段 07 运行产生的事件。之前累计全部历史，
    // 同一 (railName, role) 会重复出现，既撞 React key 又和 rail.stats 的计数对不上。
    if (!belongsToLatestRun(source, 7, event)) continue
    const data = payload(event)
    const railName = String(data.railName ?? "")
    const role = String(data.role ?? "")
    if (!RAIL_NAMES.has(railName) || !ROLE_NAMES.has(role)) continue
    out.push({
      railName: railName as RailName,
      role: role as RoleName,
      tool: typeof data.tool === "string" ? data.tool : undefined,
      file: typeof data.file === "string" ? data.file : undefined,
      line: typeof data.line === "number" ? data.line : undefined,
      reason: String(data.reason ?? ""),
      expected: String(data.expected ?? ""),
      actual: String(data.actual ?? ""),
      contractHash: String(data.contractHash ?? "pending"),
      recoveryHint: String(data.recoveryHint ?? ""),
      severity: data.severity === "warn" ? "warn" : "block",
    })
  }
  return out
}

/** 某工段最近一次 stage.started 的 seq：只展示这一次运行产生的事件。 */
function latestStageStartSeq(source: FactorySource, stage: StageId): number | null {
  for (let index = source.events.length - 1; index >= 0; index -= 1) {
    const event = source.events[index]
    if (!event || event.type !== "stage.started" || stageNumberOf(event) !== stage) continue
    return event.seq
  }
  return null
}

function belongsToLatestRun(source: FactorySource, stage: StageId, event: AgentEvent): boolean {
  const startSeq = latestStageStartSeq(source, stage)
  if (startSeq === null) return true
  if (event.seq < startSeq) return false
  const eventStage = stageNumberOf(event)
  return eventStage === null || eventStage === stage
}

export function mapAdversarial(source: FactorySource): AdversarialBoard {
  const attacks = new Map<string, AttackFinding>()
  const judgeInvariants: string[] = []
  for (const event of source.events) {
    if (!belongsToLatestRun(source, 8, event)) continue
    const data = payload(event)
    if (event.type === "attack.finding") {
      const id = String(data.id ?? `attack_${attacks.size + 1}`)
      attacks.set(id, {
        id,
        severity: (["critical", "high", "medium", "low", "info"].includes(String(data.severity)) ? String(data.severity) : "medium") as AttackFinding["severity"],
        title: String(data.title ?? "未命名攻击"),
        resolved: String(data.status ?? "open") === "resolved",
        evidenceRefs: [],
      })
    }
    if (event.type === "judge.invariant") {
      judgeInvariants.push(`${String(data.name ?? data.id ?? "invariant")}：${data.passed ? "通过" : "失败"}（期望 ${String(data.expected ?? "?")}，实际 ${String(data.actual ?? "?")}）`)
    }
  }
  return { attacks: [...attacks.values()], judgeInvariants, repairs: [] }
}
export function mapCruise(source: FactorySource): CruiseView {
  const steps = []
  const errors = []
  for (const event of source.events) {
    if (!belongsToLatestRun(source, 8, event)) continue
    const data = payload(event)
    if (event.type === "cruise.step") {
      steps.push({
        id: `step_${String(data.index ?? steps.length + 1)}`,
        label: String(data.label ?? "巡航步骤"),
        status: (["done", "running", "failed"].includes(String(data.status)) ? String(data.status) : "failed") as "done" | "running" | "failed",
        screenshot: typeof data.screenshotPath === "string" ? data.screenshotPath : undefined,
      })
    }
    if (event.type === "cruise.error") {
      const anchorId = ANCHOR_ORDER.some((item) => item.id === data.anchorId) ? (data.anchorId as CruiseView["errors"][number]["anchorId"]) : "procurement.submit"
      errors.push({ anchorId, message: String(data.message ?? "") })
    }
  }
  return {
    steps,
    errors,
    healChain: [
      { kind: "anchor", label: "锚点" },
      { kind: "source", label: "源文件" },
      { kind: "fix", label: "修复" },
      { kind: "rerun", label: "重跑" },
    ],
  }
}

export function mapDelivery(source: FactorySource): DeliveryReport {
  let reported: {
    stats?: Array<{ label: string; value: string | number }>
    verified?: boolean
    blocked?: string[]
    unverified?: string[]
    evolution?: { name: string; generated: boolean }
    prDraft?: { state: "draft" | "ready" | "blocked"; path?: string }
  } | null = null
  for (const event of source.events) {
    if (event.type !== "delivery.report") continue
    const data = payload(event)
    reported = {
      stats: Array.isArray(data.stats) ? (data.stats as Array<{ label: string; value: string | number }>) : undefined,
      verified: data.verified === true,
      blocked: Array.isArray(data.blocked) ? (data.blocked as string[]) : undefined,
      unverified: Array.isArray(data.unverified) ? (data.unverified as string[]) : undefined,
      evolution: data.evolution as { name: string; generated: boolean } | undefined,
      prDraft: data.prDraft as { state: "draft" | "ready" | "blocked"; path?: string } | undefined,
    }
  }
  const evidence: EvidenceItem[] = source.events.slice(-8).map((event) => ({
    seq: event.seq,
    type: event.type,
    ref: `${event.taskId}:${event.seq}`,
  }))
  const stats = reported?.stats ?? [
    { label: "证据事件", value: evidence.length },
    { label: "人工介入", value: 0 },
    { label: "未验证项", value: reported ? "见交付报告" : "工厂数据未接入" },
  ]
  return {
    runId: source.task?.runId ?? "未运行",
    stats,
    evidence,
    verified: reported?.verified === true,
    blocked: reported?.blocked,
    unverified: reported?.unverified,
    evolution: reported?.evolution,
    prDraft: reported?.prDraft,
  }
}

export function mapApprovals(source: FactorySource): ApprovalRecord[] {
  const out: ApprovalRecord[] = []
  for (const event of source.events) {
    if (event.type !== "approval.resolved") continue
    const data = payload(event)
    out.push({
      stage: Number(data.stage ?? 0),
      kind: String(data.kind ?? ""),
      subject: String(data.subject ?? ""),
      decision: String(data.decision ?? "approved"),
      actor: String(data.actor ?? "operator"),
      at: String(data.at ?? event.time ?? ""),
    })
  }
  return out
}

export function mapSourceLedger(source: FactorySource): SourceLedgerView | null {
  for (let index = source.events.length - 1; index >= 0; index -= 1) {
    const event = source.events[index]
    if (!event || event.type !== "source.ledger") continue
    const data = payload(event)
    const entries = Array.isArray(data.entries) ? (data.entries as SourceEntry[]) : []
    return { entries, unknownLicenses: Number(data.unknownLicenses ?? 0) }
  }
  return null
}

export function mapPermission(source: FactorySource): PermissionView | null {
  for (let index = source.events.length - 1; index >= 0; index -= 1) {
    const event = source.events[index]
    if (!event || event.type !== "judge.permission") continue
    const data = payload(event)
    return {
      mode: String(data.mode ?? "static"),
      checks: Array.isArray(data.checks) ? (data.checks as PermissionCheck[]) : [],
      passed: Number(data.passed ?? 0),
      failed: Number(data.failed ?? 0),
    }
  }
  return null
}

export function mapRailStats(source: FactorySource): RailStatsView | null {
  for (let index = source.events.length - 1; index >= 0; index -= 1) {
    const event = source.events[index]
    if (!event || event.type !== "rail.stats") continue
    const data = payload(event)
    return { rails: Number(data.rails ?? 0), checks: Number(data.checks ?? 0), violations: Number(data.violations ?? 0) }
  }
  return null
}

export function mapPrototype(source: FactorySource): PrototypeView {
  for (let index = source.events.length - 1; index >= 0; index -= 1) {
    const event = source.events[index]
    if (!event || event.type !== "prototype.ready") continue
    const data = payload(event)
    return {
      ready: true,
      path: typeof data.path === "string" ? data.path : null,
      product: typeof data.product === "string" ? data.product : null,
      anchors: Array.isArray(data.anchorList) ? (data.anchorList as PrototypeAnchorView[]) : [],
      entities: Array.isArray(data.entities) ? (data.entities as PrototypeEntityView[]) : [],
    }
  }
  return { ready: false, path: null, product: null, anchors: [], entities: [] }
}

export function mapStageVerdict(source: FactorySource, stage: StageId): StageVerdict {
  const events = source.events.filter((event) => stageNumberOf(event) === stage)
  const lastOf = (type: string) => {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event && event.type === type) return event
    }
    return null
  }
  const status = stageStatus(source, stage)
  const finished = lastOf("stage.completed") ?? lastOf("stage.failed")
  const durationRaw = Number(finished ? payload(finished).durationMs : NaN)
  const durationMs = Number.isFinite(durationRaw) ? durationRaw : null
  let conclusion = "尚未执行"
  let mode: StageVerdict["mode"] = "none"

  if (stage === 0) {
    // s0.ts 发的是 assets（资产条数），不是 files；读错字段会让结论恒显示「? 个文件」。
    const manifest = lastOf("baseline.manifest")
    const assets = Number(payload(manifest ?? ({} as never)).assets)
    conclusion = manifest
      ? Number.isFinite(assets) ? `资产清单 ${assets} 个文件` : "资产清单已生成"
      : "仓库已接入"
    mode = "deterministic"
  }
  if (stage === 1) {
    const diagnosis = lastOf("greenbuild.diagnosis")
    conclusion = diagnosis ? `构建退出码 ${String(payload(diagnosis).exitCode)} · ${String(payload(diagnosis).classification)}` : "尚未尝试构建"
    mode = "deterministic"
  }
  if (stage === 2) {
    const rule = lastOf("archaeology.rule")
    const rules = Array.isArray(payload(rule ?? ({} as never)).rules) ? (payload(rule ?? ({} as never)).rules as unknown[]) : []
    const aiRules = Number(payload(rule ?? ({} as never)).aiRules ?? 0)
    conclusion = rule ? `规则 ${rules.length} 条${aiRules > 0 ? ` · AI ${aiRules} 条` : ""}` : "尚未提取规则"
    mode = String(payload(rule ?? ({} as never)).mode ?? "") === "ai" ? "ai" : rule ? "deterministic" : "none"
  }
  if (stage === 3) {
    const equivalence = lastOf("decompile.equivalence")
    const skipped = lastOf("stage.skipped")
    const failed = lastOf("stage.failed")
    if (equivalence) {
      const cases = Number(payload(equivalence).cases ?? 0)
      const mismatches = Number(payload(equivalence).mismatches ?? 0)
      conclusion = mismatches === 0
        ? `${cases} 组差分对拍全部一致`
        : `${cases} 组中有 ${mismatches} 组不一致`
      mode = "deterministic"
    } else if (skipped) {
      conclusion = "本仓库没有黑盒目标，工段不适用"
      mode = "none"
    } else if (failed) {
      conclusion = String(payload(failed).message ?? "阻断")
      mode = "deterministic"
    } else {
      conclusion = "未执行"
      mode = "none"
    }
  }
  if (stage === 4) {
    const harness = lastOf("skill.harness")
    conclusion = harness ? `验毒 ${String(payload(harness).passed)}/${String(payload(harness).cases)} 通过` : "尚未封装技能"
    mode = harness ? "deterministic" : "none"
  }
  if (stage === 5) {
    const locked = lastOf("contract.locked")
    conclusion = locked ? `契约 v${String(payload(locked).version)} 已锁定 · ${String(payload(locked).hash).slice(0, 8)}` : "尚未锁定契约"
    mode = locked ? "deterministic" : "none"
  }
  if (stage === 6) {
    const merge = lastOf("role.merge")
    const files = merge && Array.isArray(payload(merge).mergedFiles) ? (payload(merge).mergedFiles as unknown[]) : []
    const backend = events.filter((event) => event.type === "role.run.finished" && String(payload(event).role ?? "") === "Backend Builder").at(-1)
    const aiBackend = String(backend ? payload(backend).source ?? "" : "") === "ai"
    conclusion = merge ? `${files.length} 个文件合并${aiBackend ? " · 后端 AI 生成" : ""}` : "尚未制造"
    mode = merge ? (aiBackend ? "ai" : "deterministic") : "none"
  }

  if (stage === 7) {
    const stats = lastOf("rail.stats")
    conclusion = stats ? `检查 ${String(payload(stats).checks)} 项 · 阻断 ${String(payload(stats).violations)} 条` : "尚未检查"
    mode = stats ? "deterministic" : "none"
  }
  if (stage === 8) {
    const attack = lastOf("attack.finding")
    conclusion = attack ? String(payload(attack).title ?? "攻防已执行") : "尚未执行"
    mode = attack ? "deterministic" : "none"
  }
  if (stage === 9) {
    const report = lastOf("delivery.report")
    const stats = report && Array.isArray(payload(report).stats) ? (payload(report).stats as Array<{ label: string; value: unknown }>) : []
    const evidence = stats.find((item) => item.label === "证据事件")?.value ?? "?"
    const artifacts = stats.find((item) => item.label === "产物")?.value ?? "?"
    conclusion = report ? `证据 ${String(evidence)} 条 · 产物 ${String(artifacts)} 个` : "尚未交付"
    mode = report ? "deterministic" : "none"
  }

  return { status, conclusion, durationMs, mode }
}

export function stageProgress(stages: StageView[]): number {
  const finished = stages.filter((stage) => stage.status === "done").length
  // 不适用的工段（例如仓库没有黑盒时的工段 03）从分母中排除，
  // 否则任何仓库都永远到不了 100%。
  const applicable = stages.filter((stage) => stage.status !== "not_applicable").length
  return Math.round((finished / Math.max(1, applicable)) * 100)
}

export function anchorLabels(): ReadonlyArray<{ id: string; label: string; icon: string }> {
  return ANCHOR_ORDER
}

export type { ServerTask, RepoSummary }
