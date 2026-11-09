# RepoPilot Lite 设计系统 v2（增强版 / 权威）

> 本文件是 `ui-kit-v2` 的视觉权威，与 `tokens/tokens.css` 一一对应。
> v2 是 v1 的**超集**：保留蓝紫身份与无衬线，新增受控玻璃、氛围层、动效、骨架与控件高度，
> 提升友好度、设计感与交互感。与历史代码冲突时，以本文件和 `ui-kit-v2` 为准。

## 1. 设计方向：有温度的证据工作台

RepoPilot Lite 是本地优先的 Coding Agent。前端的任务不是"做一个聊天窗口"，而是把 Agent
不确定的执行过程，变成用户可**计划、可审批、可验证、可撤销**的工程工作流。

v2 在 v1 的四个关键词上，补一个"可感知（responsive）"：

- **精确（precise）**：每个状态、数字、结论都来自运行时事实，不装饰、不夸大。
- **冷静（calm）**：中性表面、单一主色、克制的状态色，适合长时间阅读代码与日志。
- **证据导向（evidence-led）**：计划、命令、退出码、diff、检查结果都保留可审计入口。
- **克制（restrained）**：能用间距和排版表达层级，就不用边框、卡片和阴影。
- **可感知（responsive）**：每次悬停、按压、切换、加载都有即时、轻量、可预期的反馈。

v2 吸收了 `New-F-UI-Skills`（OmniDirector）的**方法论**——玻璃面板、氛围层、入场动效、
骨架、Toast、两步确认、stepper；但**不迁移其金色 `#d9b36a` 与中文衬线 `Noto Serif SC`**，
也不复制第三方资产。同时沿用 `UI.md`（Vercel/Geist）的信息架构与可访问性方法，不使用其
品牌资产、Geist 字体或 `.vbg-*` 类名。

### 明确禁止（v2 仍生效）

- 装饰性渐变、渐变文字、发光（glow）、模糊光斑、条纹、纹理、**玻璃堆叠**（多层玻璃叠加）。
- 装饰性衬线标题（`Noto Serif SC` 已废弃）；金色动作语言（v2 不引入）。
- 霓虹/赛博朋克配色、**让所有卡片持续脉冲/漂浮**、自动滚动、模拟打字光标。
- 用等半径卡片网格把层级压平；卡片嵌套卡片；用边框/盒子弥补薄弱层级。
- 仅靠颜色表达状态；用 Emoji 充当功能图标。

> 玻璃在 v2 是**受控材质**：单层、半透明、配发丝边与克制 blur，只用于浮层/粘性条/局部面板，
> 不允许玻璃叠玻璃、不允许整页玻璃化。

## 2. 色彩系统

### 2.1 分层规则

- 组件只消费**语义 token**（`--rp-*`），禁止裸 hex、禁止在组件里重新声明颜色。
- 原始色板沉淀在 `tokens.css` 的 `:root` 与 `[data-theme="dark"]`，组件不直接引用原始值。
- 柔和背景统一使用 `--rp-*-muted`（已计算好的 rgba），不要用 `color-mix` 临时拼。

### 2.2 表面与文字（浅色 / 深色）

| 语义 token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--rp-bg` | `#f4f5f2` | `#101315` | 应用底色 |
| `--rp-surface` | `#ffffff` | `#171b1e` | 面板、栏 |
| `--rp-surface-muted` | `#ecefea` | `#202629` | 代码区、输入、次级背景 |
| `--rp-surface-raised` | `#ffffff` | `#242b2f` | 对话框、浮层 |
| `--rp-text` | `#172027` | `#edf1ee` | 主文字 |
| `--rp-text-secondary` | `#52606a` | `#b5c0c1` | 次级文字 |
| `--rp-text-muted` | `#78848b` | `#839093` | 弱化/元信息 |
| `--rp-border` | `#d7ddd9` | `#303a3e` | 常规边框 |
| `--rp-border-strong` | `#aeb8b3` | `#526166` | 强调边框/分隔 |

v2 新增两个半透明覆盖（不引入新实色）：

- `--rp-surface-hover`：可点击行/卡片的悬停覆盖。
- `--rp-surface-selected`：选中态的柔和覆盖（与 `--rp-accent` 同色系）。

### 2.3 主色（蓝）的语义边界

蓝色只表达四类元素：**主动作、当前选中、焦点、链接**。

| token | 浅色 | 深色 |
| --- | --- | --- |
| `--rp-accent` | `#4f6fe8` | `#87a0ff` |
| `--rp-accent-strong` | `#3655c7` | `#a5b7ff` |
| `--rp-accent-ink` | `#ffffff` | `#11151a` |
| `--rp-accent-muted` | `rgba(79,111,232,.10)` | `rgba(135,160,255,.14)` |
| `--rp-focus` | `#2b65d9` | `#9eb5ff` |

不要因为某块内容"重要/有利"就把它染蓝。成功、警告、失败、信息使用独立状态色。

### 2.4 状态色（低饱和）+ 柔和背景

| 语义 | 实色（浅/深） | muted 背景（浅/深） |
| --- | --- | --- |
| ok 成功 | `#2f8a67` / `#6ac19d` | `rgba(47,138,103,.10/.14)` |
| warn 警告 | `#b87921` / `#e3ae5b` | `rgba(184,121,33,.10/.14)` |
| danger 危险/失败 | `#c95656` / `#ef8585` | `rgba(201,86,86,.10/.14)` |
| info 信息 | `#467b9f` / `#87b3d0` | `rgba(70,123,159,.10/.14)` |

**状态必须同时包含文字 + 图标/形状 + 颜色**，并满足非颜色线索，确保色觉障碍用户与单色打印
仍可辨认。对比度以 WCAG AA 为底线。

### 2.5 主题机制

- 浅色优先：`:root` 是浅色，`[data-theme="dark"]` 是深色。
- 主题挂在 `<html>`：`document.documentElement.dataset.theme`，取值 `light` / `dark`。
- 持久化键 `localStorage["rp-theme"]`，首次访问默认 `dark`。
- 切换只改 token，不重排组件结构，避免布局跳动。

## 3. 排版

### 3.1 字体族

```css
--rp-font-sans: "IBM Plex Sans", Inter, system-ui, ... "PingFang SC", "Microsoft YaHei", sans-serif;
--rp-font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

- **Sans** 用于几乎所有 UI：标题、正文、标签、按钮、表格、KPI、日期。
- **Mono** 仅用于代码、命令、路径、原始 token、ID、runId、时间戳、计数等操作型标识；
  只把标识符本身设为 Mono，不要整句/整表 Mono。
- 字体文件通过 `index.html` 引入；离线或未加载时自动回退系统字体，不阻塞渲染。
- **不使用任何衬线字体**（废弃 `Noto Serif SC`），v2 不引入金色衬线。

### 3.2 字号尺度

| token | 值 | 用途 |
| --- | --- | --- |
| `--rp-fs-meta` | 10px | eyebrow / caption / 元信息 |
| `--rp-fs-compact` | 11px | 辅助文本、时间、小标签 |
| `--rp-fs-ui` | 12px | tab、列表标题、按钮、面板正文 |
| `--rp-fs-control` | 13px | 输入、上下文条、小字正文 |
| `--rp-fs-body` | 14px | 页面可读正文 |
| `--rp-fs-h3` | 16px | 三级标题 |
| `--rp-fs-h2` | 20px | 对话框/区块二级标题 |
| `--rp-fs-h1` | `clamp(24px,3vw,32px)` | 页面主标题 |
| `--rp-fs-metric` | 24px | KPI 数字 |

不允许创建尺度外的任意字号。行高：`tight 1.15 / snug 1.4 / normal 1.55 / relaxed 1.65`；
字重：`400 / 500 / 600`。标题用句式大小写，Latin eyebrow 才允许宽字距。

## 4. 材质层（v2 新增）

玻璃是半透明表面，让下层内容"透"出来，建立空间层次，但强度受控：

| token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--rp-glass-bg` | `rgba(255,255,255,.72)` | `rgba(23,27,30,.70)` | 玻璃面板默认 |
| `--rp-glass-bg-strong` | `rgba(255,255,255,.92)` | `rgba(28,33,37,.92)` | 对话框/Toast/命令面板 |
| `--rp-glass-blur` | `blur(12px) saturate(1.5)` | 同 | 背景模糊 |
| `--rp-hairline` | `rgba(17,25,31,.08)` | `rgba(255,255,255,.08)` | 玻璃面板发丝边 |

使用规则：

1. 玻璃元素必须配 `backdrop-filter`（含 `-webkit-` 前缀）与 1px 发丝边，不再加重边框。
2. 玻璃上的文字对比度仍须满足 AA；若透出内容导致可读性下降，改用 `glass-bg-strong`。
3. 不支持 `backdrop-filter` 的环境自动回退为不透明 `--rp-surface`（提供降级写法）。
4. 同一视图最多一层玻璃，禁止玻璃叠玻璃、禁止把普通面板整体玻璃化。

## 5. 氛围层（v2 新增）

氛围层是固定、不滚动、不接收指针的**纯背景**，由 `.app-shell::before/::after` 挂载，包含：

- 极低强度网格（`--rp-atmos-grid`，32px 网格，仅在顶部用 mask 局部显示）。
- 主色柔和光晕（`--rp-atmos-glow`，右上角径向，强度 ≤12%）。
- 底部暗角（`--rp-atmos-vignette`，帮助聚焦中部内容）。

规则：氛围层 `z-index:0` 且 `pointer-events:none`，所有内容在其之上；不做星尘/胶片颗粒；
不随状态切换改变色温（不引入 OmniDirector 的 `data-scene`）。氛围只在页面留白处可见，
不压在文字与代码上。

## 6. 间距、圆角、阴影、层级

### 6.1 间距（8 档）

```
--rp-space-1 4   --rp-space-2 8   --rp-space-3 12  --rp-space-4 16
--rp-space-5 20  --rp-space-6 24  --rp-space-7 32  --rp-space-8 40
```

每个间隙只有一个所有者：容器 `gap` 负责，子元素不加竞争 margin。

### 6.2 圆角（严格四档）

```
--rp-radius-control 6px  控件/按钮/输入
--rp-radius-panel  10px  面板/卡片
--rp-radius-sheet  14px  sheet/modal/对话框
--rp-radius-pill   999px 状态点/胶囊
```

### 6.3 控件高度（v2 新增）与触控目标

| token | 值 | 用途 |
| --- | --- | --- |
| `--rp-control-sm` | 32px | 紧凑工具栏、命令行 |
| `--rp-control-md` | 38px | 默认按钮、输入 |
| `--rp-control-lg` | 44px | 主 CTA、移动端控件 |
| `--rp-touch-target` | 44px | 触控目标下限 |

### 6.4 阴影（仅浮层）

普通面板靠背景分层 + 边框，默认无阴影。`--rp-shadow-sm` 激活 tab；`--rp-shadow-md` 下拉/
弹出/Toast；`--rp-shadow-lg` 模态/抽屉。遮罩 `--rp-overlay-bg`。

### 6.5 层级与布局

```
z: base 0 / sticky 10 / dropdown 15 / overlay 20 / modal 30 / toast 40
rail-width 248 / evidence-width 300 / bar-height 56 / page-max 1440
```

## 7. 动效（v2 增强，详见 motion-and-interaction.md）

- 时长：`fast 120 / base 160 / slow 240 / slower 400`；缓动 `ease-out / ease-in /
  ease-inout / ease-spring`（轻微回弹，仅用于 pop 入场）。
- 只动 `transform` 与 `opacity`；入场用 rise/fade/pop，列表用 stagger 交错（≤8 项）。
- 按压反馈：`press-scale .97`；主按钮 hover 轻微抬升（`hover-lift -2px`），press 下沉。
- 骨架 shimmer 表达加载；持续脉冲**仅**给待确认（`.attention`）与实时点（`.live-pulse`）。
- `prefers-reduced-motion: reduce` 时统一压到 1ms，直接呈现最终状态。

## 8. Do / Don't 速查

| Do | Don't |
| --- | --- |
| 用 `var(--rp-*)` | 裸 hex、临时 color-mix |
| 单层受控玻璃 + 发丝边 | 玻璃堆叠、整页玻璃化 |
| 氛围只在留白处、不压内容 | 星尘/颗粒/随状态改色温 |
| 间距 + 排版建立层级 | 到处包卡片、加边框 |
| 按压下沉、hover 轻抬 | 所有卡片持续脉冲/漂浮 |
| 蓝色只给主动作/选中/焦点/链接 | 把重要内容一律染蓝 |
| 破坏性动作两步确认 | 一次点击直接删除 |
| 状态 = 文字 + 图标 + 颜色 | 只靠颜色、用 Emoji 当图标 |
| 错误保留输入并给恢复路径 | 用控件消失暗示完成 |
