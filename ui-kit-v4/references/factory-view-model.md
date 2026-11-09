# 工厂前端视图类型合同（Factory View Model）

> 本文件是 v4 工厂前端的 **TypeScript 视图层类型合同**。
> 目标：让 Codex 不自己臆造数据结构，所有视图都从统一任务/事件/证据对象单向映射；
> 数据未到位时用诚实空态/blocked，不写假数据。
> 与 `shared/schemas.ts`（现有 9 状态/22 事件）兼容，不改动后端契约，只做呈现层。

## 1. 分层原则

```text
服务器事实（AgentServer：任务/事件/证据/契约，JSONL + 存储）
        │  单向映射（纯函数，无副作用）
        ▼
视图模型 ViewModel（本文件定义，前端 src/view-model 内）
        │  纯渲染
        ▼
DOM（components-v4 类名，data-panshi-id）
```

- 视图模型是**只读投影**：组件不直接改服务器对象，写操作走 `runtime` 既有方法。
- 映射函数必须是纯函数，输入相同输出相同，便于单测。
- 任何字段后端没有就标 `null`/`undefined`，并在视图上走空态，禁止用占位字符串假装存在。

## 2. 基础原语（全视图复用）

```ts
/** 哈希摘要，统一截断展示，不臆造 */
export type Hash = string; // 如 "sha256:9f3a…c2"

/** 证据引用，对应统一证据协议 */
export interface EvidenceRef {
  runId: string;
  stageRunId: string;
  artifactId: string;
  status: EvidenceStatus;
  contractHash?: Hash;
  failure?: FailureDetail;
  recovery?: RecoveryDetail;
}

export type EvidenceStatus =
  | "pending" | "collecting" | "verified" | "failed" | "blocked";

export interface FailureDetail {
  reason: string;
  errorCode?: string;
  occurredAt: string; // ISO 时间
}

export interface RecoveryDetail {
  plan: string;
  retryCount: number;
  requiresApproval: boolean;
}

/** 产物（输入/输出） */
export interface ArtifactRef {
  artifactId: string;
  name: string;
  kind: "schema" | "openapi" | "component-tree" | "report" | "code" | "skillpack" | "evidence" | "other";
  hash?: Hash;
  state: "input" | "output" | "locked" | "blocked";
}

/** 预算（对应 BudgetRail） */
export interface BudgetView {
  used: number;      // 已用（与 limit 同单位）
  limit: number;     // 上限
  paused: boolean;   // 超预算被暂停
}
export function budgetPercent(b: BudgetView): number {
  if (b.limit <= 0) return 0;
  return Math.min(100, Math.round((b.used / b.limit) * 100));
}
```

## 3. 工段视图 StageView（对应 `.stage-rail` / `.stage-view`）

```ts
export type StageStatus =
  | "pending" | "active" | "done" | "failed" | "blocked";

export interface StageView {
  stage: StageId;            // 0..9
  name: string;              // 中文名
  status: StageStatus;
  selected: boolean;
  exitCriteria: string;      // 退出条件，来自规划，不硬编码业务值
  inputs: ArtifactRef[];
  outputs: ArtifactRef[];
  overallPercent: number;    // 仅当可量化时给值，否则 0 并配文字
  contractHash?: Hash;
}

export type StageId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const STAGE_ORDER: StageId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
```

## 4. 角色视图 RoleView（对应 `.role-card`）

```ts
export type RoleName =
  | "Chief Architect" | "Contract Builder" | "Database Builder"
  | "Backend Builder" | "Frontend Builder" | "Seed Data Builder"
  | "Skill Integrator" | "Judge" | "Red Agent" | "Blue Agent"
  | "Visual Agent" | "Archiver";

export type RoleStatus =
  | "queued" | "running" | "done" | "failed" | "blocked";

export interface RoleView {
  role: RoleName;
  short: string;             // 头像缩写，如 DB/BE/FE
  status: RoleStatus;
  budget: BudgetView;
  stage: StageId;
  concurrent: boolean;       // 是否处于真实并发组
  meta?: string;             // 阻断原因等，来自服务器，不编造
}
```

## 5. 业务锚点视图（对应 7 个 data-panshi-id）

```ts
/** 锚点 id 必须与 component_tree.json 完全一致，禁止自造 */
export type PanshiAnchorId =
  | "procurement.table"
  | "procurement.create"
  | "procurement.invoice_verify"
  | "procurement.submit"
  | "approval.timeline"
  | "inventory.summary"
  | "budget.dashboard";

export interface BizAnchor {
  anchorId: PanshiAnchorId;
  route: string;             // 来自 OpenAPI，禁止硬编码
  rbac: string;              // 写操作路由的 RBAC 标记
  locked: boolean;
}

export interface RowState {
  id: string;
  state: "approved" | "pending" | "rejected";
}
```

## 6. 契约视图 ContractView（对应 `.contract-review`）

```ts
export type ContractKind = "schema.sql" | "openapi.yaml" | "component_tree.json";

export interface ContractView {
  kind: ContractKind;
  version: number;
  locked: boolean;
  hash: Hash;
  content?: string;          // 锁定后只读展示
  approvedAt?: string;
}

/** 锁定契约只能出新版本，不能改 locked；视图层不提供"编辑已锁定"入口 */
export interface ContractLockBanner {
  message: string;
  nextVersionHint: string;
}
```

## 7. 护栏阻断视图 RailViolation（对应 `.rail-violation`）

```ts
export type RailName =
  | "ForbiddenMemoryRail" | "ContextRedactionRail" | "PermissionInterruptRail"
  | "ContractVerifyRail" | "CodingMemoryRail" | "BudgetRail" | "AuditRail";

export interface RailViolation {
  railName: RailName;
  role: RoleName;
  tool?: string;
  file?: string;
  line?: number;
  reason: string;
  expected: string;
  actual: string;
  contractHash: Hash;
  recoveryHint: string;
  severity: "block" | "warn";
}
```

## 8. 攻防视图（对应 `.adversarial-board`）

```ts
export interface AttackFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  resolved: boolean;
  evidenceRefs: EvidenceRef[];
}

export interface AdversarialBoard {
  attacks: AttackFinding[];      // 红军
  judgeInvariants: string[];    // 裁判不变量（Judge 不读实现源码）
  repairs: RepairTask[];         // 蓝军
}

export interface RepairTask {
  id: string;
  findingId: string;
  status: "queued" | "running" | "done";
}
```

## 9. 巡航与自愈视图（对应 `.cruise-view` / `.self-heal`）

```ts
export interface CruiseStep {
  id: string;
  label: string;
  status: "done" | "running" | "failed";
  screenshot?: string;   // Visual Agent 真实截图引用，无则不显示
}

export interface HealNode {
  kind: "anchor" | "source" | "fix" | "rerun";
  label: string;
}

export interface CruiseView {
  steps: CruiseStep[];
  errors: CruiseError[];
  healChain: HealNode[]; // 锚点 → 源文件 → 修复 → 重跑
}

export interface CruiseError {
  anchorId: PanshiAnchorId;
  message: string;
}
```

## 10. 证据交付与 RSI 视图

```ts
export interface EvidenceItem {
  seq: number;
  type: string;
  ref: string;
}

export interface DeliveryReport {
  runId: string;
  stats: { label: string; value: string | number }[];
  evidence: EvidenceItem[];
  verified: boolean;
}

export interface SkillPackView {
  name: string;
  source: string;          // MCP tools/list 来源
  tools: number;
  registered: boolean;
}

export interface PrDraftView {
  state: "draft" | "ready" | "blocked";
  title: string;
  body: string;
  note?: string;
}
```

## 11. 映射函数签名（纯函数，服务器对象 → 视图）

```ts
import type { TaskObject, EventObject } from "../../shared/schemas"; // 统一对象

export function mapStage(
  stage: StageId,
  tasks: TaskObject[],
  events: EventObject[],
  selected: boolean,
): StageView;

export function mapRoles(tasks: TaskObject[]): RoleView[];

export function mapContracts(artifacts: ArtifactRef[]): ContractView[];

export function mapRailViolations(events: EventObject[]): RailViolation[];

export function mapAdversarial(tasks: TaskObject[], events: EventObject[]): AdversarialBoard;

export function mapCruise(events: EventObject[]): CruiseView;

export function mapDelivery(evidence: EvidenceRef[], events: EventObject[]): DeliveryReport;
```

## 12. 诚实空态 / blocked 判定（核心，禁止假通过）

```ts
export type ViewAvailability =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "empty"; why: string; next: string }
  | { kind: "blocked"; reason: string; recoveryHint: string }
  | { kind: "error"; failure: FailureDetail };

export function availabilityFor(
  status: string | undefined,
  hasData: boolean,
  externalReachable: boolean,
): ViewAvailability {
  if (!externalReachable)
    return { kind: "blocked", reason: "外部依赖不可用", recoveryHint: "检查网络/适配器后重试" };
  if (status === "blocked")
    return { kind: "blocked", reason: "工段被护栏阻断", recoveryHint: "查看阻断证据并处理" };
  if (status === "failed")
    return { kind: "error", failure: { reason: "工段执行失败", occurredAt: new Date(0).toISOString() } };
  if (!hasData)
    return { kind: "empty", why: "该工段尚未产出", next: "等待上游工段完成" };
  return { kind: "ready" };
}
```

- 内部视图保留：固定样例、实际次数、失败、人工介入、未验证项；不把未执行显示成通过。
- 对外 PPT 叙事（100%/零误差/30 秒/¥2）与内部验收数据分开，视图层不混用。

## 13. 落地位置建议

```text
apps/code-agent/src/
├─ view-model/
│  ├─ factory-types.ts      # 本文件全部类型
│  ├─ mappers.ts            # 第 11 节纯函数
│  └─ availability.ts       # 第 12 节
└─ components/factory/      # 消费这些类型，渲染 components-v4 类名
```

- 每个 mapper 配一个单测（vitest），用固定 fixture，不依赖真实网络。
- 不新增平行状态枚举；现有 `TaskStatus`/`EventType` 能表达的复用，工厂扩展只在本文件内收窄。
