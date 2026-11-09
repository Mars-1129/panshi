import type { AgentEvent, RepoSummary, ServerTask } from "../types"

export type Hash = string

export type EvidenceStatus = "pending" | "collecting" | "verified" | "failed" | "blocked"

export interface FailureDetail {
  reason: string
  errorCode?: string
  occurredAt: string
}

export interface RecoveryDetail {
  plan: string
  retryCount: number
  requiresApproval: boolean
}

export interface EvidenceRef {
  runId: string
  stageRunId: string
  artifactId: string
  status: EvidenceStatus
  contractHash?: Hash
  failure?: FailureDetail
  recovery?: RecoveryDetail
}

export type ArtifactKind = "schema" | "openapi" | "component-tree" | "report" | "code" | "skillpack" | "evidence" | "other"
export type ArtifactState = "input" | "output" | "locked" | "blocked"

export interface ArtifactRef {
  artifactId: string
  name: string
  kind: ArtifactKind
  hash?: Hash
  state: ArtifactState
}

export interface BudgetView {
  used: number
  limit: number
  paused: boolean
}

export function budgetPercent(budget: BudgetView): number {
  if (budget.limit <= 0) return 0
  return Math.min(100, Math.round((budget.used / budget.limit) * 100))
}

export type StageId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
/**
 * not_applicable：该仓库没有本工段适用的对象（例如没有黑盒时的工段 03）。
 * 不是失败——进度分母排除它，交付判定不会因此变为未通过。
 */
/** not_applicable：该仓库没有本工段适用的对象（如没有黑盒时的工段 03）；不计入进度分母。 */
export type StageStatus = "pending" | "active" | "done" | "failed" | "blocked" | "not_applicable"

export interface StageView {
  stage: StageId
  name: string
  sub: string
  status: StageStatus
  selected: boolean
  exitCriteria: string
  inputs: ArtifactRef[]
  outputs: ArtifactRef[]
  overallPercent: number
  contractHash?: Hash
}

export const STAGE_ORDER: StageId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/** 每个工段的"下一步"引导（静态文案，来自路线图；不表示已完成）。 */
export const STAGE_GUIDE: Record<StageId, string> = {
  0: "确认仓库与基线，然后为本次改造新建一次工厂运行",
  1: "接入旧项目资产包后，在受限沙箱里跑一次原始构建",
  2: "构建通过后，按切片提取业务规则并标注来源行号",
  3: "选定一个纯计算函数，完成反编译与差分对拍",
  4: "把一个外部 MCP 工具转换为 SkillPack 并通过 Harness",
  5: "先确认原型，再生成三份契约并锁定哈希",
  6: "契约锁定后，让数据库 / 后端 / 前端角色并发产出",
  7: "核对七道护栏规则，确认每次阻断都有证据",
  8: "服务启动后，跑红蓝对抗与浏览器巡航",
  9: "汇总证据生成交付报告，并沉淀本次经验",
}

/** 工段期望产物（MVP 文档 Stage 0–9 的产物清单，用于前后端对表）。 */
export const STAGE_ARTIFACTS: Record<StageId, string[]> = {
  0: ["ProjectManifest", "BaselineSnapshot", "SecretScanReport", "EnvironmentSummary"],
  1: ["EnvironmentDiagnosis", "DependencyConflict[]", "FixDiff", "BuildLog", "RunVerdict", "UnresolvedDependency[]"],
  2: ["CodeSlice[]", "CallGraph", "BusinessRule[]", "StateTransition[]", "SqlAccess[]", "UnanalyzedArea[]", "RuleEvidence[]"],
  3: ["SymbolReport", "DecompiledSource", "GeneratedImplementation", "DifferentialCase[]", "MismatchReport", "EquivalenceReport"],
  4: ["SkillManifest", "SKILL.md", "wrapper.py", "SkillHarnessReport", "DependencyReport", "LicenseReport", "SkillRegistryEntry", "SkillHubPullRequestDraft"],
  5: ["ClarificationLog", "PrototypeSnapshot", "schema.sql", "openapi.yaml", "component_tree.json", "ContractValidation", "ContractBundle", "ApprovalRecord"],
  6: ["RoleRun[]", "RoleWorkspace[]", "RoleBudget[]", "MergeReport", "RetryRecord[]"],
  7: ["RailViolation[]", "RailAuditEvent[]", "RailStats"],
  8: ["AttackReport", "InvariantResult[]", "PermissionReport", "RepairDiff", "PlaywrightTrace", "Screenshot[]", "PageError[]", "ReplayReport"],
  9: ["DeliveryReport", "EvidenceChain", "ApprovalLedger", "EvolutionPack", "SkillHubPullRequestDraft", "SourceLedger"],
}

export type GapStatus = "shown" | "empty" | "missing"

/**
 * 后端对接缺口清单：MVP 文档要求的产物 → 前端当前承载情况。
 * shown = 已用真实数据渲染；empty = 有承载位置但恒为空态；missing = 前端尚无位置。
 * `source` 是建议的事件 / 字段名，供后端与前端对齐（尚未实现，属建议契约）。
 */
export type BackendGap = { stage: StageId; name: string; source: string; ui: GapStatus }

export const BACKEND_GAPS: BackendGap[] = [
  { stage: 0, name: "ProjectManifest（资产清单 + 哈希）", source: "event: baseline.manifest", ui: "shown" },
  { stage: 0, name: "BaselineSnapshot（基线 revision）", source: "task.baseRevision", ui: "shown" },
  { stage: 0, name: "SecretScanReport（敏感信息扫描）", source: "event: baseline.secretScan", ui: "shown" },
  { stage: 0, name: "EnvironmentSummary（运行时/包管理器）", source: "event: baseline.environment", ui: "shown" },
  { stage: 1, name: "EnvironmentDiagnosis（构建命令 / exit code / 分类）", source: "event: greenbuild.diagnosis", ui: "shown" },
  { stage: 1, name: "DependencyConflict[]（依赖冲突表）", source: "event: greenbuild.conflicts", ui: "empty" },
  { stage: 1, name: "FixDiff（环境修复 diff）", source: "event: greenbuild.fix", ui: "missing" },
  { stage: 1, name: "RunVerdict（可运行判定 + 未解决依赖）", source: "event: greenbuild.verdict", ui: "shown" },
  { stage: 2, name: "CodeSlice[] / CallGraph（AST 切片与调用图）", source: "event: archaeology.slice", ui: "shown" },
  { stage: 2, name: "BusinessRule[] + RuleEvidence[]（规则与来源行号）", source: "event: archaeology.rule", ui: "shown" },
  { stage: 2, name: "UnanalyzedArea[]（动态未分析项）", source: "event: archaeology.unanalyzed", ui: "shown" },
  { stage: 3, name: "SymbolReport / DecompiledSource", source: "event: decompile.symbols", ui: "missing" },
  { stage: 3, name: "DifferentialCase[] / MismatchReport（对拍）", source: "event: decompile.diff", ui: "missing" },
  { stage: 3, name: "EquivalenceReport（等价结论）", source: "event: decompile.equivalence", ui: "missing" },
  { stage: 4, name: "SkillManifest + SKILL.md + wrapper", source: "event: skill.build", ui: "shown" },
  { stage: 4, name: "SkillHarnessReport（正例/异常用例）", source: "event: skill.harness", ui: "shown" },
  { stage: 4, name: "LicenseReport / DependencyReport（供应链）", source: "event: skill.license", ui: "shown" },
  { stage: 4, name: "SkillRegistryEntry + PR 草稿", source: "event: skill.register", ui: "shown" },
  { stage: 5, name: "ClarificationLog（需求澄清对话）", source: "event: clarify.message", ui: "missing" },
  { stage: 5, name: "PrototypeSnapshot（可点击原型）", source: "artifact: prototype.html", ui: "shown" },
  { stage: 5, name: "三份契约正文（schema / openapi / component_tree）", source: "event: contract.*", ui: "shown" },
  { stage: 5, name: "ContractValidation（校验结果）", source: "event: contract.validate", ui: "shown" },
  { stage: 5, name: "ContractBundle（哈希 + 版本 + 锁定）", source: "event: contract.locked", ui: "shown" },
  { stage: 5, name: "ApprovalRecord（人工批准）", source: "event: approval.resolved", ui: "shown" },
  { stage: 6, name: "RoleRun[]（角色并发运行）", source: "event: role.run.*", ui: "shown" },
  { stage: 6, name: "RoleWorkspace[]（隔离工作区）", source: "role.workspace", ui: "shown" },
  { stage: 6, name: "RoleBudget[]（预算与暂停）", source: "role.budget", ui: "shown" },
  { stage: 6, name: "MergeReport + RetryRecord[]（合并与重试）", source: "event: role.merge", ui: "empty" },
  { stage: 7, name: "RailViolation[]（10 个证据字段）", source: "event: rail.violation", ui: "shown" },
  { stage: 7, name: "RailAuditEvent[]（审计留痕）", source: "event: rail.audit", ui: "shown" },
  { stage: 7, name: "RailStats（规则数与检查文件数）", source: "event: rail.stats", ui: "shown" },
  { stage: 8, name: "AttackReport（请求 / 响应记录）", source: "event: attack.finding", ui: "shown" },
  { stage: 8, name: "InvariantResult[]（裁判不变量）", source: "event: judge.invariant", ui: "shown" },
  { stage: 8, name: "PermissionReport（越权检查）", source: "event: judge.permission", ui: "shown" },
  { stage: 8, name: "RepairDiff（蓝军修复）", source: "artifact: repair-diff.patch", ui: "shown" },
  { stage: 8, name: "PlaywrightTrace / Screenshot[] / PageError[]", source: "event: cruise.step", ui: "missing" },
  { stage: 8, name: "ReplayReport（断点重跑）", source: "event: cruise.replay", ui: "shown" },
  { stage: 9, name: "DeliveryReport（时间线 / 检查 / 风险 / 未验证）", source: "event: delivery.report", ui: "shown" },
  { stage: 9, name: "EvidenceChain（证据链）", source: "event.evidenceRefs", ui: "shown" },
  { stage: 9, name: "ApprovalLedger（人工介入记录）", source: "event: approval.\*", ui: "shown" },
  { stage: 9, name: "EvolutionPack（RSI 经验包）", source: "event: rsi.evolution", ui: "shown" },
  { stage: 9, name: "SkillHubPullRequestDraft", source: "artifact: skillhub-pr.md", ui: "shown" },
  { stage: 9, name: "SourceLedger（来源与许可证台账）", source: "event: source.ledger", ui: "shown" },
]

/**
 * 工段执行合同（静态规格，来自《MVP 实现路径与洋葱圈路线图》Stage 1–4）。
 * 只用于展示"计划链路"，不代表已经执行；接入后端后由真实事件取代。
 */
export const STAGE_STEPS: Partial<Record<StageId, string[]>> = {
  1: [
    "识别运行时、包管理器与启动入口",
    "在受限容器内执行一次原始构建",
    "捕获 stdout / stderr / 退出码并分类依赖错误",
    "生成修复 diff，等待人工批准后写入环境文件",
    "重新构建并保存基线靶机状态",
  ],
  2: [
    "tree-sitter 解析入口、控制器、DAO 与 SQL",
    "构建有限调用图，切分带来源位置的业务片段",
    "按片段提取业务规则，记录文件与行号",
    "归档规则库，标记无法静态分析的动态行为",
    "把规则关联到后续契约与验收项",
  ],
  3: [
    "nm -D 导出符号，定位目标计算函数",
    "Ghidra Headless 导出伪 C 与函数签名",
    "Agent 还原为可读的现代实现",
    "ctypes 加载原库，生成随机与边界样本",
    "差分对拍，差异输入进入 Finding 并回修",
  ],
  4: [
    "启动固定版本 MCP Server，发送 JSON-RPC tools/list",
    "读取工具名称、描述与 inputSchema",
    "生成 SKILL.md 与 wrapper（超时 / 异常 / 空值）",
    "Harness 内加载并执行正例与异常用例",
    "来源、许可证与依赖扫描后注册到本地技能库",
  ],
}

/** 7 道确定性护栏（规则定义是静态的；阻断记录来自真实事件）。 */
export const RAIL_ORDER: ReadonlyArray<{ name: string; desc: string }> = [
  { name: "ForbiddenMemoryRail", desc: "角色访问控制：裁判 Agent 不得读取实现源码" },
  { name: "ContextRedactionRail", desc: "上下文脱敏：敏感字段进入模型前掩码或阻断" },
  { name: "PermissionInterruptRail", desc: "人工审批中断：未批准不得写入业务代码" },
  { name: "ContractVerifyRail", desc: "契约静态校验：路由、字段、RBAC 与 data-panshi-id" },
  { name: "CodingMemoryRail", desc: "规范注入：政企底座与编码基线" },
  { name: "BudgetRail", desc: "预算控制：超出预算的角色暂停执行" },
  { name: "AuditRail", desc: "审计留痕：每次阻断写入事件日志" },
]


export const STAGES: ReadonlyArray<{ id: StageId; name: string; sub: string; desc: string; icon: string }> = [
  { id: 0, name: "接入基线", sub: "Project intake", desc: "输入资产、基线 revision 与敏感信息扫描", icon: "PlugZap" },
  { id: 1, name: "环境救活", sub: "GreenBuild", desc: "旧项目在受限沙箱中完成一次真实构建", icon: "HeartPulse" },
  { id: 2, name: "业务考古", sub: "Legacy Archaeologist", desc: "AST 切片、调用图与业务规则归档", icon: "Search" },
  { id: 3, name: "二进制对拍", sub: "Decompile & Diff", desc: "Ghidra 反编译与差分等价验证", icon: "Binary" },
  { id: 4, name: "技能封装", sub: "Meta-Skill Builder", desc: "外部 MCP / 工具转换为本地 SkillPack", icon: "Puzzle" },
  { id: 5, name: "需求 / 契约", sub: "Prototype & Contract", desc: "原型确认与三份契约锁定", icon: "MessagesSquare" },
  { id: 6, name: "多角色制造", sub: "SwarmFlow", desc: "数据库、后端、前端角色并发产出", icon: "Users" },
  { id: 7, name: "护栏", sub: "Rails", desc: "七道确定性护栏阻断非法写入", icon: "ShieldCheck" },
  { id: 8, name: "双擎质检", sub: "Adversarial QA", desc: "红蓝对抗、不变量校验与浏览器巡航", icon: "Swords" },
  { id: 9, name: "RSI 交付", sub: "Delivery & Ecosystem", desc: "证据交付与经验沉淀为 SkillPack", icon: "Rocket" },
]

export type RoleName =
  | "Chief Architect"
  | "Contract Builder"
  | "Database Builder"
  | "Backend Builder"
  | "Frontend Builder"
  | "Seed Data Builder"
  | "Skill Integrator"
  | "Judge"
  | "Red Agent"
  | "Blue Agent"
  | "Visual Agent"
  | "Archiver"

export type RoleStatus = "queued" | "running" | "done" | "failed" | "blocked"

export interface RoleView {
  role: RoleName
  short: string
  status: RoleStatus
  budget: BudgetView
  stage: StageId
  concurrent: boolean
  meta?: string
}

export const ROLE_ORDER: ReadonlyArray<{ role: RoleName; short: string; stage: StageId; icon: string }> = [
  { role: "Chief Architect", short: "CA", stage: 5, icon: "Compass" },
  { role: "Contract Builder", short: "CB", stage: 5, icon: "FileSignature" },
  { role: "Database Builder", short: "DB", stage: 6, icon: "Database" },
  { role: "Backend Builder", short: "BE", stage: 6, icon: "Server" },
  { role: "Frontend Builder", short: "FE", stage: 6, icon: "MonitorSmartphone" },
  { role: "Seed Data Builder", short: "SD", stage: 6, icon: "Sprout" },
  { role: "Skill Integrator", short: "SI", stage: 4, icon: "Puzzle" },
  { role: "Judge", short: "JG", stage: 8, icon: "Scale" },
  { role: "Red Agent", short: "RED", stage: 8, icon: "Sword" },
  { role: "Blue Agent", short: "BLUE", stage: 8, icon: "ShieldPlus" },
  { role: "Visual Agent", short: "VA", stage: 8, icon: "Eye" },
  { role: "Archiver", short: "AR", stage: 9, icon: "Archive" },
]

export type PanshiAnchorId =
  | "procurement.table"
  | "procurement.create"
  | "procurement.invoice_verify"
  | "procurement.submit"
  | "approval.timeline"
  | "inventory.summary"
  | "budget.dashboard"

export interface BizAnchor {
  anchorId: PanshiAnchorId
  route: string
  rbac: string
  locked: boolean
}

export const ANCHOR_ORDER: ReadonlyArray<{ id: PanshiAnchorId; label: string; icon: string }> = [
  { id: "procurement.table", label: "采购表格", icon: "Table" },
  { id: "procurement.create", label: "新建采购", icon: "FilePlus2" },
  { id: "procurement.invoice_verify", label: "发票核验", icon: "ReceiptText" },
  { id: "procurement.submit", label: "提交审批", icon: "Send" },
  { id: "approval.timeline", label: "审批时间线", icon: "GitCommitHorizontal" },
  { id: "inventory.summary", label: "库存汇总", icon: "Boxes" },
  { id: "budget.dashboard", label: "预算看板", icon: "Gauge" },
]

export interface RowState {
  id: string
  state: "approved" | "pending" | "rejected"
}

export type ContractKind = "schema.sql" | "openapi.yaml" | "component_tree.json"

export interface ContractView {
  kind: ContractKind
  version: number
  locked: boolean
  hash: Hash
  content?: string
  approvedAt?: string
}

export interface ContractLockBanner {
  message: string
  nextVersionHint: string
}

export type RailName =
  | "ForbiddenMemoryRail"
  | "ContextRedactionRail"
  | "PermissionInterruptRail"
  | "ContractVerifyRail"
  | "CodingMemoryRail"
  | "BudgetRail"
  | "AuditRail"

export interface RailViolation {
  railName: RailName
  role: RoleName
  tool?: string
  file?: string
  line?: number
  reason: string
  expected: string
  actual: string
  contractHash: Hash
  recoveryHint: string
  severity: "block" | "warn"
}

export interface AttackFinding {
  id: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  title: string
  resolved: boolean
  evidenceRefs: EvidenceRef[]
}

export interface RepairTask {
  id: string
  findingId: string
  status: "queued" | "running" | "done"
}

export interface AdversarialBoard {
  attacks: AttackFinding[]
  judgeInvariants: string[]
  repairs: RepairTask[]
}

export interface CruiseStep {
  id: string
  label: string
  status: "done" | "running" | "failed"
  screenshot?: string
}

export interface HealNode {
  kind: "anchor" | "source" | "fix" | "rerun"
  label: string
}

export interface CruiseError {
  anchorId: PanshiAnchorId
  message: string
}

export interface CruiseView {
  steps: CruiseStep[]
  errors: CruiseError[]
  healChain: HealNode[]
}

export interface EvidenceItem {
  seq: number
  type: string
  ref: string
}

export interface DeliveryEvolution { name: string; generated: boolean }
export interface DeliveryPullRequest { state: "draft" | "ready" | "blocked"; path?: string }

export interface DeliveryEvolution { name: string; generated: boolean }
export interface DeliveryPullRequest { state: "draft" | "ready" | "blocked"; path?: string }

export interface DeliveryReport {
  runId: string
  stats: Array<{ label: string; value: string | number }>
  evidence: EvidenceItem[]
  verified: boolean
  blocked?: string[]
  unverified?: string[]
  evolution?: DeliveryEvolution
  prDraft?: DeliveryPullRequest
}

export interface ApprovalRecord { stage: number; kind: string; subject: string; decision: string; actor: string; at: string }
export interface SourceEntry { id: string; kind: string; name: string; origin: string; license: string; note: string }
export interface SourceLedgerView { entries: SourceEntry[]; unknownLicenses: number }
export interface PermissionCheck { method: string; path: string; requiredScope: string | null; declaredScope: string | null; passed: boolean; reason: string }
export interface PermissionView { mode: string; checks: PermissionCheck[]; passed: number; failed: number }
export interface RailStatsView { rails: number; checks: number; violations: number }

export interface StageVerdict { status: StageStatus; conclusion: string; durationMs: number | null; mode: "ai" | "deterministic" | "none" }

export interface PrototypeAnchorView { id: string; label: string; route: string; scope: string | null; method?: string }
export interface PrototypeEntityView { table: string; fields: Array<{ name: string; type: string }> }
export interface PrototypeView { ready: boolean; path: string | null; product: string | null; anchors: PrototypeAnchorView[]; entities: PrototypeEntityView[] }

export interface SkillPackView {
  name: string
  source: string
  tools: number
  registered: boolean
}

export interface PrDraftView {
  state: "draft" | "ready" | "blocked"
  title: string
  body: string
  note?: string
}

export type FactorySource = {
  task: ServerTask | null
  events: AgentEvent[]
  repo: RepoSummary | null
  runtimeReachable: boolean
}
