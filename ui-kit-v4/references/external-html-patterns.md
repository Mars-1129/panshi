# external-html-patterns · 外部概念页可吸收模式与 v4 映射

> 来源：`reference-html/`（framed-sheet 概念页，隔离区）。本文件只提炼**结构、信息组织、
> 交互与数据口径**，所有落地一律用 v4 的 `var(--rp-*)` 与既有类名重绘。
> 铁律：**借模式，不借视觉**。参考页的颜色、字体、圆角、阴影、GSAP 一律不进产品。

## 0. 一眼对照：两套体系的边界

| 维度 | 参考页（不照搬） | 产品 v4（唯一权威） |
|---|---|---|
| 强调色 | `#0071e3` | `var(--rp-accent)` |
| 字体 | `-apple-system` 系统栈 | `var(--rp-font-sans)` / `var(--rp-font-mono)` |
| 容器语言 | framed sheet、细边框、无阴影 | `var(--rp-radius-*)` + `var(--rp-border)`，受控玻璃 |
| 动效 | GSAP + CSS | 仅 CSS（`css/motion.css`），尊重 reduced-motion |
| 工段数 | 5 工段（概念简化） | **9 Stage + Stage 0**，以 MVP 文档为准 |
| 类名 | `.stage-pill/.terminal/.kpi-*` 等 | `.rp` 体系既有类名，禁止把参考类名带进 App |

## 1. 可吸收模式 → v4 落地映射

### 模式 A · 三栏工作台与"输入源 / 智能体"侧栏
- 参考：`index-final.html`（`.main-container` + `.sidebar-left/right` + `.main-content`）。
- 价值：左栏把"项目切换器 + 输入源列表 + 协作智能体列表 + 侧栏脚"组织成稳定信息区；
  右栏是"当前工段进度 + 管道 + 导出快照"。
- v4 映射：外壳沿用 `.factory-shell/.factory-body`；工段导航用 `.stage-rail`。
  左栏的"输入源/智能体列表"在需要时用**既有件组合**：`.source-item` 概念 → 用
  `.list-row`/`.role-card` 或 `.biz-nav .nav-item` 重绘，不新造平行列表；
  项目切换用 `.select-control`。右栏进度用现有 `.stage-progress`。

### 模式 B · 工段 pill 顶导航（窄屏备选）
- 参考：`.nav-stages` + `.stage-pill`，带滑动的 `.nav-selection` 与底线 `.nav-indicator`。
- 价值：横向空间不足时，工段可收成一条可横滑的 pill。
- v4 映射：主形态仍是左侧 `.stage-rail`；**≤1024px** 导航变抽屉（`.is-rail-open`），
  若产品需要顶部工段条，用 `.segmented` 承载，不引入参考的胶囊物理动效。

### 模式 C · 终端/日志工具条（本轮补 CSS）
- 参考：`.terminal`（`.terminal-header` + `.terminal-filter`：级别下拉 + 暂停 + 清空 +
  导出，`.terminal-body[role=log]`，`.terminal-footer` 计数）。
- 价值：日志不只是滚动文本，要有**级别过滤、暂停追增、清空、导出、条数计数**。
- v4 映射：在现有 `.log-viewer` 上补 `.log-toolbar`（放 `.select-control` + 按钮 +
  `.count-badge`），`.log-body` 保留 `role="log"`；分级色沿用 `.log-info/warn/error/ok`。
  按钮用 `.button-quiet`/图标按钮，不新造按钮样式。

### 模式 D · 原型设备预览框（本轮补 CSS）
- 参考：`prototype-view.html`（`.proto-frame` 浏览器框 + 三点 chrome + URL 行 + iframe，
  设备切换 desktop/tablet/phone，手机态改圆角 20px）。
- 价值：在工厂内审查业务原型时，用一个"被框住的设备"承载，并能切尺寸。
- v4 映射：新增 `.device-preview`（`.device-chrome` + `.device-url` + `.device-canvas`），
  尺寸用 `data-device="desktop|tablet|phone"` 切换，宽度用 `--rp-*` 间距/圆角表达；
  设备切换用 `.segmented`。iframe 内容仍是 7 锚点业务原型，根元素带 `data-panshi-id`。

### 模式 E · KPI 口径注（本轮补 CSS）
- 参考：`.kpi-grid/.kpi-card`（`.kpi-label` + `.kpi-value` + `.kpi-note`，note 写清
  口径，如"3 张待审订单之和""122/127，较上月 +0.4pct"）。
- 价值：每个数字都能回答"这是什么、怎么算的"，避免无出处的大数字。
- v4 映射：数字卡沿用 `.inv-metric`/`.report-stat`/`.metric-card`，补一个
  `.metric-note`（小号、`var(--rp-text-muted)`），告警口径用 `.is-low` 同款 warn 色；
  数值用等宽数字（`font-variant-numeric: tabular-nums`，`.num` 工具类）。
  **口径缺失的数字不允许展示**，与"禁止假模拟"一致。

### 模式 F · 表格合计行 tfoot（本轮补 CSS）
- 参考：`prototype-demo.html` 的 `<tfoot>`（本页合计、行数口径），金额列右对齐。
- v4 映射：给 `.procurement-table` 补 `tfoot td` 样式（顶部分隔线、`var(--rp-text-muted)`、
  等宽数字、金额右对齐）。合计由数据现算，不允许写死；无合计语义时不渲染 tfoot。

### 模式 G · 筛选按钮组
- 参考：`.filter-group/.filter-btn`，选中态变实心。
- v4 映射：直接用 `.segmented`（`.segment-item.is-active`），不新造筛选样式。

### 模式 H · 快速操作网格
- 参考：`.quick-actions/.quick-action`（2 列网格，线性图标 + 文案，hover 换底）。
- v4 映射：用 `display:grid` + 现有 `.button`/`.list-row` + lucide 图标组合，
  图标继承 `currentColor`，不引入参考的内联 SVG。

### 模式 I · 需求追踪矩阵（本轮补 CSS）
- 参考：`.requirement-trace/.requirement-list/.requirement-row`
  （`.requirement-index` + `.requirement-text` + `.requirement-target` + `.requirement-kind`）。
- 价值：把"需求条目 → 锚点/契约目标 → 类型"逐条对齐，支撑契约可追溯。
- v4 映射：新增 `.trace-matrix`（`.trace-row/.trace-index/.trace-text/.trace-target/.trace-kind`），
  target 用 `.tag` 呈现锚点 id（与 `data-panshi-id` 一致），kind 用状态色但不只靠颜色。

### 模式 J · 分段滑动指示器（可选增强）
- 参考：`.seg-control` + 绝对定位 `.seg-indicator` 随选中项平移。
- v4 映射：`.segmented` 现为静态选中底；若加滑动指示器，用 CSS transform 实现，
  并在 `prefers-reduced-motion` 下取消过渡、直接换位。**不使用 GSAP。**

### 模式 K · 多轨管道步骤
- 参考：`.pipeline-track/.pipeline-step/.pipeline-mark`（ready/done/active 多态）。
- v4 映射：单轨进度用现有 `.stage-progress`；仅当需要"多轨并行"时才用 grid 组合多个
  `.stage-dot` 风格节点，状态编码复用 `.state-*`，不另起一套 mark。

### 模式 L · 可访问性细节（核对，不必新增）
- 参考：`.skip-link`、`role="log"`、`aria-live`、原生 `<dialog>`、`.sr-only`、`aria-pressed`。
- v4 映射：产品已有 `.sr-only`、焦点环、`aria-live` 区域与 dialog；落地时逐条核对：
  跳转链接、图标按钮可访问名、日志区 role、开关 `aria-checked`、进度条 `role="progressbar"`。

## 2. 禁止照搬清单（出现即返工）

1. 任何参考页的裸色值（`#0071e3` 等）、系统字体栈、GSAP 与参考类名进入产品代码。
2. `import`/`<link>` `reference-html/styles-final.css`，或把 vendor/gsap 当依赖。
3. 把概念页的 5 工段当成产品工段——产品是 **9 Stage + Stage 0**，以 MVP 文档为准。
4. 复制参考页里的静态演示数据冒充真实工段；数据未到位仍走诚实空态/blocked。
5. 为这些模式另造平行按钮/列表/卡片类名；必须复用 v4 既有件与 `var(--rp-*)`。

## 3. 本轮落地优先级

- **补 CSS（任务 37）**：模式 C 日志工具条、模式 D 设备预览框、模式 E 口径注、
  模式 F 合计行、模式 I 需求追踪；模式 J 作为可选增强。
- **只作模式参考、不新增件**：A/B/G/H/K/L，用既有件组合并在提示词中说明。
- 全部新增件只消费 `var(--rp-*)`，并在 `preview/v4-factory-demo.html` 增加真实 DOM 演示，
  明暗 + 窄屏 headless 验证通过后再打包。
