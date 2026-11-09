# PanShi-SwarmFactory · 前端纪律（data-panshi-id 与诚实呈现）

> 这是 v4 前端的**硬性纪律**，优先级高于视觉美化。Codex/GPT 实现前端时必须逐条满足，验收时逐条核对。
> 依据：`MVP实现路径与洋葱圈路线图.md`。本纪律只约束前端呈现与契约，不改变后端工作流。

---

## 一、组件锚点纪律：data-panshi-id

### 1. 所有交互组件必须带 `data-panshi-id`

业务系统原型中每个可交互元素（表格、表单、按钮、提交、时间线、汇总、看板）都必须带 `data-panshi-id` 属性，值**取自 `component_tree.json`**，不允许前端自造。

固定 7 个锚点（与验收 A06 对齐）：

| data-panshi-id | 组件 | 绑定 |
|---|---|---|
| `procurement.table` | 采购单表格 | 列表数据 |
| `procurement.create` | 新建采购单 | 表单 |
| `procurement.invoice_verify` | 发票核验按钮 | 转换后的发票核验 Skill |
| `procurement.submit` | 提交审批 | 写操作（带 RBAC） |
| `approval.timeline` | 审批时间线 | 审批流 |
| `inventory.summary` | 库存汇总 | 库存数据 |
| `budget.dashboard` | 预算看板 | 预算数据 |

### 2. 锚点命名规则

- 点分命名：`<域>.<组件>`，如 `procurement.table`；子元素可继续点分，如 `procurement.submit.button`。
- 锚点是**稳定契约**：Visual Agent 巡航、契约校验、E2E 都靠它定位，改名必须走契约新版本。
- 开发模式下用 `.anchor-flag` 显示锚点名、悬停高亮，便于核对；生产模式隐藏标记但保留属性。

### 3. 为什么必须有锚点

- Visual Agent（Playwright）通过 `data-panshi-id` 定位元素，不依赖易变的 CSS 类名或文案。
- 契约校验可核对"声明的组件树"与"实际渲染的锚点"是否一致。
- 自愈时能把"失败锚点 → 对应源文件 → 修复 → 重跑"串成可追溯链。

---

## 二、路由与字段纪律：来自 OpenAPI，禁止硬编码

1. **路由来自 OpenAPI**：页面跳转、请求路径只能引用 `openapi.yaml` 中定义的路径，禁止在组件里写死 URL 字符串。
2. **字段来自 schema/OpenAPI**：表格列、表单字段、数据键名必须来自 `schema.sql` / `openapi.yaml`，禁止前端臆造字段。
3. **写操作带 RBAC 标记**：提交、审批、核验等写操作的路由要带权限标识，未授权角色不可触发；未审批通过前不得写业务代码。
4. 三份契约（`schema.sql`、`openapi.yaml`、`component_tree.json`）锁定后，前端只能消费锁定版本；契约变更走新版本，不直接改 locked。
5. 前端不允许为了"好看"添加契约之外的字段或页面；需要新字段时提契约变更，而不是硬编码。

---

## 三、统一证据协议（前端呈现必须保留这些字段）

每个可追溯对象在前端都要能展示统一证据字段，不得丢弃：

- 证据协议：`runId`、`stageRunId`、`artifactId`、`evidenceRefs`、`status`、`failure`、`recovery`、`contractHash`
- 任务对象：`projectId`、`runId`、`parentRunId`、`stage`、`role`、`status`、`contractId`、`inputArtifacts`、`outputArtifacts`、`evidenceRefs`、`approvalState`、`budget`、`retryCount`、`failure`、`recoveryPlan`
- 事件对象：`seq`、`runId`、`stageRunId`、`role`、`eventType`、`time`、`payload`、`evidenceRefs`、`contractHash`、`parentEventId`

前端展示要求：

1. 关键产物旁能看到 `contractHash`（哈希），证明基于锁定契约。
2. 事件按 `seq` 排序，时间线可回溯到 `evidenceRefs`。
3. 阻断/失败要能展开 `failure` 与 `recovery`，不能只显示一个红色图标。

---

## 四、诚实呈现：禁止把未执行显示成通过

这是最重要的诚信纪律（对应 MVP 第 12 节"禁止假模拟"）。

1. **状态只能来自真实事件/证据**：未执行、执行中、阻断、失败、成功五态分清，前端不得把"未执行/阻断"显示成"通过/成功"。
2. **外部不可用就显示 blocked**：MCP、模型、浏览器、Git 等外部依赖不可用时，输出 `blocked` 与原因，不允许用假数据填充后显示成功。
3. **未验证项必须显式列出**：报告里用 `.report-verify` 标注"未验证项"，不能省略。
4. **数据未到位给诚实空态**：后端数据模型尚未覆盖的工段（M0–M6 逐步扩展），前端用空态/骨架 + "该工段尚未接入"说明，不编造角色、数字、报告。
5. **真实次数与失败可见**：内部界面保留固定样例、实际执行次数、失败次数、人工介入次数，不显示无法回溯的 100%。

---

## 五、内外叙事分离

- **对外演示/PPT**：可保留"100%、零误差、30 秒、¥2"等张力叙事。
- **内部验收/前端界面**：必须保留固定样例、实际次数、失败、人工介入、未验证项；数字必须可点击回溯到证据。
- 同一前端不允许把内部未验证项包装成对外承诺；两类视图分开，不混用。

---

## 六、护栏与审批的呈现

1. 护栏阻断用 `.rail-violation` 完整展示：`railName`、`role`、`tool`、`file`、`line`、`reason`、`expected`、`actual`、`contractHash`、`recoveryHint`。
2. 审批（契约锁定、计划确认、预算超限、外部调用）必须显式给出 Allow/Reject，未决议前不继续执行。
3. 超预算角色显示"已暂停"，不允许继续触发写操作。
4. 阻断写操作要进事件日志，前端时间线能看到该阻断事件及其证据。

---

## 七、多角色与并发的呈现

1. 角色卡显示真实角色名（12 角色），不允许用"AI 助手"一个角色代替多角色。
2. 真实并发（DB/Backend/Frontend ≥3 角色）用并发指示呈现，基于事件时间证明并发，而不是静态图标。
3. 裁判角色（Judge）的结论不展示其读取后端/前端源码的入口（它被禁止读实现源码）。
4. 角色失败显示重试次数与恢复计划，不允许静默吞掉。

---

## 八、前端自检清单（Codex 提交前必过）

- [ ] 7 个锚点组件全部带正确 `data-panshi-id`，值与 `component_tree.json` 一致。
- [ ] 无硬编码路由/字段；全部来自 OpenAPI/schema。
- [ ] 写操作带 RBAC；未审批不写业务代码。
- [ ] blocked/failed 不会被渲染成 succeeded/passed。
- [ ] 未验证项、失败、人工介入、真实次数在内部视图可见。
- [ ] 数据未到位的工段是诚实空态，无假数据。
- [ ] 关键产物可见 contractHash；事件可回溯 evidenceRefs。
- [ ] 明暗主题、1024/640 响应式、reduced-motion 均正常。
- [ ] `pnpm typecheck`、`pnpm build`、`pnpm test` 全绿。
