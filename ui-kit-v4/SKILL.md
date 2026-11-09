---
name: panshi-ui-kit-v4
description: "Design, build, refactor, review, or verify the PanShi-SwarmFactory frontend with the v4 factory kit. Use for React 19 + Vite + TypeScript surfaces: software-factory cockpit, Stage 0-9 rail, multi-role cards, interactive business prototype (procurement/approval/inventory/budget with data-panshi-id), contract review/lock, rail violations, red-blue adversarial board, browser cruise self-heal, evidence chain, delivery report, RSI outputs, plus all v3 chat and v2 glass/motion components. Read this before changing any UI."
metadata:
  product: PanShi-SwarmFactory
  status: authoritative
  version: 4
  supersedes: repopilot-ui-kit-v3
  stack: React 19 / Vite 6 / TypeScript / lucide-react
---

# PanShi-SwarmFactory UI Kit v4（政企软件工厂 / 单一执行入口）

v4 把产品从「单个编码 Agent」升级为 **PanShi-SwarmFactory 磐石蜂群工厂（政企软件工厂）**：
前端要呈现完整工厂链路（Stage 0–9）、多角色真实并发、契约锁定、护栏阻断、红蓝攻防、
浏览器巡航自愈、统一证据与 RSI 交付，同时保留 v3 的对话式需求澄清。v4 是 v3 的**全量超集**，
沿用同一 `--rp-*` token 与蓝紫视觉，新增工厂组件与 `data-panshi-id` 锚点纪律。
本包是前端唯一设计权威：任何 UI 改动先读本文件，再按 references 与 css 执行。

## 何时使用

- 新建、重构、审查或验收 PanShi-SwarmFactory 前端（`apps/code-agent`），实现工厂全链路界面。
- 实现带 data-panshi-id 的业务原型、契约审查、护栏、攻防、巡航、证据交付。
- 调整 token、主题、对话、玻璃/氛围、动效、响应式或可访问性。
- 不用于后端工作流、运行时实现或与本产品无关的工作。

## 文件地图

```text
tokens/tokens.css       权威 token：v3 全量 + v4 工厂布局/业务表面/契约/攻防/锚点，明暗双主题
css/base.css            reset、元素默认、焦点、滚动条、工具类、is-busy
css/motion.css          动效层：rise/fade/pop/shimmer/attention、stagger、骨架
css/components.css      基础组件（v1 全量 + 微交互）
css/components-v2.css   v2 交互组件：玻璃/Toast/两步确认/折叠/提示/进度
css/components-v3.css   v3 对话组件：工作台/消息/内联卡/活动/composer/产物侧栏
css/components-v4.css   v4 工厂组件：驾驶舱/工段/角色/业务原型/契约/护栏/攻防/巡航/证据/RSI
                        + 细粒度通用件（switch/复选单选/下拉/分页/树形/日志/代码块/分段/通知/抽屉/状态容器）
css/layout.css          骨架、氛围层挂载、网格、响应式
css/styles.css          聚合入口（tokens→base→motion→…→v4→layout）
references/             设计系统、组件目录、状态流、图标、a11y、动效、chat-components
                        + factory-components（v4 类名合同）+ panshi-anchor-discipline（前端纪律）
                        + factory-view-model（TS 视图类型与映射）+ factory-icons（工段/角色/护栏 lucide 选用）
                        + factory-page-map（信息架构/跳转）+ empty-and-loading-states（空态/阻断/骨架）
                        + responsive-matrix（逐档响应式表）+ gov-visual-language（政企视觉层与对齐规则）
concepts/               14 张概念图：11–14 为 v4 工厂界面（主），07–10 对话，01–06 旧监控（对照）
preview/index.html      可交互风格指南（v1–v2 组件），支持明暗切换
preview/v3-chat-demo.html  v3 对话组件渲染页
preview/v4-factory-demo.html  v4 工厂全组件 + 细粒度件真实 DOM 演示（明暗/窄屏，可直接打开）
prompts/                历史提示词 + 08 Codex 工厂前端完整实现提示词
```

## 工作流

1. 先读根目录 `MVP实现路径与洋葱圈路线图.md` 理解工厂链路与验收，再读
   `references/factory-components.md`（v4 类名合同）与 `references/panshi-anchor-discipline.md`
   （前端纪律）；落地时按任务补读 `factory-view-model`（类型与映射）、`factory-icons`（图标）、
   `factory-page-map`（信息架构）、`empty-and-loading-states`（状态）、`responsive-matrix`（响应式），
   以及 v3 chat-components 与 v2 references。先打开 `preview/v4-factory-demo.html` 看真实渲染。
2. 确认数据来源：服务器事实只来自 runtime/SSE，经 view-model 派生；本地 UI 状态不改变服务器事实。
3. 后端数据模型尚未覆盖的工段（M0–M6 逐步扩展），先做呈现层与诚实空态，不编造数据。
4. 复用现有 token 与类名；业务交互组件必须带 data-panshi-id，值取自 component_tree.json。
5. 实现全部状态；改完跑 `pnpm typecheck / build / test`，并在浏览器真实渲染（含明暗、响应式）。

## 铁律（不可协商）

1. 只消费 `var(--rp-*)`：禁止裸 hex、平行视觉系统、尺度外字号/圆角/字重。
2. 浅色优先：`:root` 浅色，`[data-theme="dark"]` 深色挂在 `<html data-theme>`；明暗同一结构。
3. **data-panshi-id：7 个业务锚点组件必须带正确锚点，值取自 component_tree.json，禁止自造。**
4. **路由与字段来自 OpenAPI/schema，禁止硬编码；写操作带 RBAC；未审批不写业务代码。**
5. **诚实呈现：blocked/failed 不得显示成通过；外部不可用显示原因；未验证项、失败、人工介入、
   真实次数在内部视图可见；数据未到位给诚实空态，不用假数据。**
6. 蓝色只表达主动作/选中/焦点/链接；状态 = 文字 + 图标/形状 + 颜色，不只靠颜色。
7. 玻璃是受控材质，不支持 backdrop-filter 时回退不透明表面。
8. 破坏性动作两步确认；审批为 Allow once / Reject；超预算角色暂停；阻断写事件日志。
9. 图标统一 lucide-react、继承 currentColor；纯图标按钮有可访问名称；禁用 Emoji 当图标。
10. 不引入新依赖、不换框架、不改后端契约，除非明确授权。
11. 满足 WCAG AA、键盘可达、触控目标 ≥44px、尊重 prefers-reduced-motion。

## 与 v3/v2/v1 及历史文档的关系

- v4 是 v3 的**全量超集**：v3 token 同名同值保留，对话组件用于需求澄清；工厂界面是新增主形态。
- 应用侧另有一层**政企视觉层**（`apps/code-agent/src/panshi.css`，后于本包加载）：把主色换成政务蓝、
  圆角收紧到 4–8px、去掉玻璃与氛围光，并修正字阶/控件高度/栅格配平。改配色只改该文件的 token，
  不改本包 css；规则见 `references/gov-visual-language.md`。
- 工厂链路、角色、契约、锚点、护栏与验收以 `MVP实现路径与洋葱圈路线图.md` 为准。
- 方法上参考根目录 `UI.md`（Vercel/Geist 方法）与 `New-F-UI-Skills`，但不使用其品牌资产。
- 当本包与代码冲突时，先核对代码，再按本包修正；只有用户要求重新采集时才改动本包规则。
