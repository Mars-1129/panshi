# 提示词 08・PanShi-SwarmFactory 工厂前端完整实现（Codex 专用）

> 用途：依据 
>
> `MVP实现路径与洋葱圈路线图.md`
>
> ，让 Codex 用 v4 素材包实现政企软件工厂前端。
> Codex 前端 / 视觉能力弱，本提示词把概念图（11–14）作为 "长什么样" 的事实源，把
> `var(--rp-*)`
>
>  作为 "用什么值" 的唯一来源，把 
>
> `data-panshi-id`
>
>  纪律作为硬约束。
> **直接复制下面整段发给 Codex；任务较大，让它按阶段逐个落地，每阶段验证后再继续。**

## 主提示词（可直接复制）



```
你是前端实现工程师，负责把 PanShi-SwarmFactory（磐石蜂群工厂 / 政企软件工厂）的前端
按 v4 素材包实现。你的视觉判断不可靠，所以本任务提供了权威素材包与高保真概念图。
技术栈固定为 React 19 + Vite 6 + TypeScript + lucide-react，包管理器 pnpm。
不要换框架、不要装新依赖、不要改后端与 runtime 契约、不要改 shared/schemas.ts 的数据定义。

【素材包位置】C:\blade\blade-agent (2)\new\ui-kit-v4（下称 ui-kit-v4）
【权威需求】C:\blade\blade-agent (2)\new\MVP实现路径与洋葱圈路线图.md（下称 MVP 文档）
【前端应用】C:\blade\blade-agent (2)\new\apps\code-agent（下称 app）

【三条最高原则，冲突时以它们为准】
1. 布局、层级、间距、材质、状态编码：严格照 ui-kit-v4/concepts/ 的 11–14 图，
   先读 concepts/README.md 逐张读图要点，不允许自由发挥、不允许"按你的审美优化"。
2. 颜色、字号、字重、圆角、间距、阴影、模糊：只能引用 var(--rp-*)，
   禁止裸 hex、禁止从图吸色、禁止临时 color-mix、禁止尺度外数值。
3. 业务系统交互组件必须带 data-panshi-id，值取自 component_tree.json（7 个固定锚点），
   禁止自造；路由与字段来自 OpenAPI/schema，禁止硬编码。

【阶段 0 · 先读再动手，不写代码】
依次读：
- MVP 文档（重点：9 个 Stage、12 角色、7 护栏、3 契约、7 锚点、统一证据协议、禁止假模拟）
- ui-kit-v4/SKILL.md
- ui-kit-v4/references/factory-components.md
- ui-kit-v4/references/panshi-anchor-discipline.md
- ui-kit-v4/references/factory-view-model.md（前端视图类型与映射，直接照此定类型，不自造）
- ui-kit-v4/references/factory-icons.md（工段/角色/护栏/锚点用哪个 lucide，照表选）
- ui-kit-v4/references/factory-page-map.md（信息架构与跳转）
- ui-kit-v4/references/empty-and-loading-states.md（空态/阻断/骨架/重试）
- ui-kit-v4/references/responsive-matrix.md（逐档响应式）
- ui-kit-v4/concepts/README.md
- ui-kit-v4/tokens/tokens.css
然后用文字复述：(a) 9 个工段名称与顺序；(b) 7 个 data-panshi-id 锚点；
(c) 明暗切换方式（<html data-theme>）；(d) 诚实呈现的五态。确认无误再写代码。
先在浏览器打开 ui-kit-v4/preview/v4-factory-demo.html，把它作为"全部组件真实渲染"的对照，
并点右上角切换明暗、缩到 390 宽看窄屏。
同时把样式入口切到 v4：app/src/main.tsx 第 4 行现在 import 的是
"../../../ui-kit-v2/css/styles.css"，改为"../../../ui-kit-v4/css/styles.css"，其余不动。

【关键边界：后端数据现状】
当前 shared/schemas.ts 只覆盖"单 Task 编码闭环"（plan/checks/patches/findings/report），
工厂链路（工段/角色/契约/攻防/巡航/RSI）的数据类型在 M0–M6 才逐步扩展。
因此本轮：
- 不改后端契约、不新增服务器数据类型；
- 先做呈现层：在 src/view-model 下按 references/factory-view-model.md 的类型合同定义前端视图类型
  （factory-types/mappers/availability），用集中、显式标注"占位/待后端接入"的常量驱动；
  映射写成纯函数并配 vitest 固定 fixture；
- 后端尚未接入的工段，一律渲染诚实空态（图标 + "该工段尚未接入/等待数据" + 原因），
  绝不能把占位数据显示成真实成功，绝不能把 blocked/failed 显示成通过。

【分阶段实现，每阶段：先复述结构与类名/token → 实现 → 自测 → 再进下一阶段】

阶段 1 · 工厂外壳与工段导航（对照 11-factory-cockpit-light.png）
  还原 .factory-shell（.factory-topbar + .factory-body）。
  顶栏：.factory-brand/.brand-mark + .factory-meta（projectId/runId，等宽）+ .factory-actions。
  左 .stage-rail：.rail-title + 10 个 .stage-item（Stage 0–9，.stage-dot + .stage-copy），
  实现状态后缀 .stage-done/.stage-active/.stage-failed/.stage-blocked/.is-selected，
  底部 .stage-progress。工段顺序与名称严格按 MVP 文档，不自行重排。
  点击工段可切换右侧视图（本地 UI 状态）。

阶段 2 · 工段视图与多角色（对照 11 图）
  右 .stage-view：.stage-title + .stage-badge（.badge-ok/warn/danger）+ .stage-exit
  （退出条件块）+ .stage-io（.io-col 输入/输出，.io-item 含 .io-name/.io-hash/.io-state）。
  多角色：.role-grid 多张 .role-card，含 .role-avatar/.role-name/.role-status +
  .role-budget 预算条 + .role-meta，状态 .role-running/.role-done/.role-failed/.role-blocked；
  用 .role-concurrency 呈现真实并发。角色名用 MVP 的 12 角色，不用"AI 助手"代替。

阶段 3 · 业务系统原型与 7 锚点（对照 12-biz-prototype-light.png，本阶段最重要）
  还原 .biz-shell（.biz-topbar + .biz-body：.biz-nav/.nav-item + .biz-page）。
  实现 7 个锚点组件，每个交互根元素带正确 data-panshi-id：
  - procurement.table：.procurement-table，状态列 .state-approved/pending/rejected
  - procurement.create：.procurement-form（.field/.field-label/.field-input）
  - procurement.invoice_verify：.invoice-verify/.verify-button（注明绑定转换后的 Skill）
  - procurement.submit：.procurement-submit（写操作，带 RBAC 标记）
  - approval.timeline：.approval-timeline/.tl-item
  - inventory.summary：.inventory-summary/.inv-metric（.is-low 告警）
  - budget.dashboard：.budget-dashboard/.budget-card/.budget-bar（.is-over 告警）
  开发态用 .anchor-flag 显示锚点名（.biz-shell[data-anchors="dev"] 悬停高亮）。
  字段与列名只引用 schema/OpenAPI 语义，不硬编码契约外字段。

阶段 4 · 契约审查与锁定
  实现 .contract-review：.contract-tabs/.ct-tab 切换 schema.sql / openapi.yaml /
  component_tree.json，.contract-panel 等宽内容，.contract-meta 显示 .hash-line
  （contractHash）+ .contract-lock + .contract-version；.is-locked 与 .lock-banner
  表达锁定态。锁定后变更走新版本的语义要在 UI 上体现，不直接改 locked。

阶段 5 · 护栏与红蓝攻防（对照 13-contract-attack-dark.png）
  护栏：.rail-list/.rail-violation，完整展示 .rv-head（.rv-name/.rv-sev）+
  .rv-body（expected/actual 等 dt/dd）+ .rv-recovery。
  攻防：.adversarial-board 三列 .attack-panel/.judge-panel/.repair-panel，
  .finding-card 带 .sev-critical/high/medium，.is-resolved 表达已修复，
  .attack-barrage 表达并发攻击。阵营色用 --rp-redteam/--rp-judge/--rp-blueteam。

阶段 6 · 巡航自愈、证据链与交付（对照 14-cruise-delivery-light.png）
  巡航：.cruise-view（.cruise-steps/.cruise-step.is-done/running/failed +
  .cruise-screenshot + .cruise-errors），.self-heal/.heal-chain 串联
  "锚点→源文件→修复→重跑"。
  证据：.evidence-chain/.ev-item（.ev-seq/.ev-type/.ev-ref），按 seq 排序。
  交付：.delivery-report/.report-section/.report-stats/.report-stat，
  未验证项用 .report-verify 显式列出，不省略。

阶段 7 · 细粒度组件、RSI 输出与响应式收尾
  细粒度通用件（对照 v4-factory-demo.html 第 8 区，类名见 components-v4 第 14 节）：
  .switch（role=switch/aria-checked）、.check-control/.radio-control（原生 input + 自定义框）、
  .select-control（.select-wrap + chevron）、.pagination（.page-item/.page-current）、
  .tree（.tree-node/.tree-children/.tree-chevron）、.log-viewer（.log-line 分级着色）、
  .code-block（.code-head + 复制按钮 + .code-content）、.segmented、.notification-center、
  .drawer（.is-drawer-open + 背景）、.tag/.count-badge；以及状态容器 .state-blocked/.state-loading。
  这些件只在需要的视图组合使用，不重复造已有的 .empty-state/.tooltip/.command 等基础件。
  RSI：.skillpack-card 与 .pr-draft（.pr-state 显示草稿态、不自动发布，.pr-note 说明）。
  核对响应式（按 responsive-matrix.md 逐档）：1024 工段导航变抽屉（.is-rail-open）、
  业务菜单转横排；640 单列、触控目标 ≥44px；明暗同一结构；prefers-reduced-motion 无持续动画。

【硬性禁止，出现即返工】
- 裸 hex、平行视觉系统、临时 color-mix、自定义尺寸/圆角/字重、从图吸色。
- 自定义 SVG 图标、emoji 当图标、引入新图标库；图标只用 lucide-react 且继承 currentColor。
- 硬编码路由/字段、自造 data-panshi-id、业务交互组件漏带锚点。
- 把未执行/blocked/failed 显示成通过/成功；用假数据冒充真实工段；省略未验证项。
- 假计时器、无法执行的假入口、无法回溯的 100% 数字；未实现给诚实空态。
- 一次点击直接执行删除/拒绝等破坏性动作；必须两步确认。
- 为深色另写一套布局或类名；改后端契约、新增依赖、换框架。

【每阶段自测，全过才进入下一阶段，并记录结果】
- pnpm --dir apps/code-agent typecheck
- pnpm --dir apps/code-agent build
- pnpm --dir apps/code-agent test（注意：当前 118 个测试必须继续通过）
- 浏览器核对该阶段对应图：浅色 + 深色、375/768/1024/1440 宽度、键盘可达、焦点可见；
  开启系统 reduced-motion 确认无持续动画。
- 全局搜索确认没有新增裸 hex（grep "#[0-9a-fA-F]{3,6}"），没有未使用的 lucide 导入。

【交付】按阶段列出：改动文件、用到的类名与 token、对照哪张图、data-panshi-id 核对结果、
验证命令结果、哪些是诚实空态/占位、遗留限制。不要把未验证项写成完成；和图不一致处
明确指出差异，不要静默带过。
```

## 给发任务的人（不必发给模型）



* **一次只让 Codex 做一个阶段**，做完对照概念图人工看一眼再继续，别一次性丢整包。

* 图内文字是占位，最终文案以 MVP 文档与 App.tsx 现有文案为准；Codex 纠结图中文字时，

  让它忽略文字、只还原结构。

* 若 Codex 写了裸 hex、想加依赖、想硬编码路由或自造锚点，直接回：

  "删掉，改用现有 var (--rp-\*) /lucide/ OpenAPI 契约，不新增东西"，不接受 "这样更简单"。

* 后端数据未到位是预期，重点核对它是否用了诚实空态而非假成功；最终用 prompts/04-qa.md

  与 references/panshi-anchor-discipline.md 的自检清单独立验收，不要让 Codex 自己验收自己。