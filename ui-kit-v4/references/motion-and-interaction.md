# 动效与微交互 v2（Motion & Interaction）

> 动效不是装饰，而是反馈与空间语言。v2 只动 `transform` 与 `opacity`，让用户感知"发生了什么、
> 我能做什么、现在到哪一步"，并始终尊重 `prefers-reduced-motion`。

## 1. 四条原则

1. **有目的**：每个动效表达入场、状态变化、加载、确认或空间连续性，不做纯装饰动画。
2. **轻而快**：常规反馈 120–160ms，入场 240ms；不拖沓、不打断。
3. **可预期**：同类元素用同一套时长与缓动；hover/press 反馈一致。
4. **克制持续动画**：只有待确认（`.attention`）与实时点（`.live-pulse`）允许持续，其余一次到位。

## 2. 时长与缓动 token

| token | 值 | 用途 |
| --- | --- | --- |
| `--rp-duration-fast` | 120ms | 悬停、按压、颜色/边框变化 |
| `--rp-duration-base` | 160ms | 按钮/输入/标签过渡、pop 入场 |
| `--rp-duration-slow` | 240ms | rise/fade 入场、抽屉 |
| `--rp-duration-slower` | 400ms | 大面积转场（少用） |
| `--rp-ease-out` | `cubic-bezier(.16,1,.3,1)` | 默认入场，自然减速 |
| `--rp-ease-in` | `cubic-bezier(.7,0,.84,0)` | 离场 |
| `--rp-ease-inout` | `ease-in-out` | 骨架、脉冲循环 |
| `--rp-ease-spring` | `cubic-bezier(.34,1.25,.64,1)` | 仅 pop 轻微回弹 |

位移与缩放：`--rp-motion-rise 12px`、`--rp-press-scale .97`、`--rp-hover-lift -2px`。

## 3. 入场动效

| 类 | 动效 | 适用 |
| --- | --- | --- |
| `.animate-rise` | 上浮 12px + 淡入 | 面板、区块首次出现 |
| `.animate-fade` | 纯淡入 | 遮罩、低层级内容 |
| `.animate-pop` | 缩放 .96→1 + 淡入（spring） | 对话框、Toast、菜单 |
| `.tab-enter` | 淡入 | 切换 tab 后的面板 |

- 容器加 `.stagger`，子元素自动按顺序延迟（前 8 个，步长 45ms），用于列表/卡片组。
- 超过 8 项不做全量 stagger，避免后面元素等待过久；只对首屏可见项交错。

## 4. 微交互（hover / press / focus）

| 反馈 | 规则 | 落地 |
| --- | --- | --- |
| Hover 抬升 | 仅主按钮，translateY(-2px) + 阴影 | `.button-primary:hover` |
| Press 下沉 | 所有按钮 scale(.97)，给出"按到了"的触感 | `.button:active` |
| 行悬停 | 改背景覆盖，不位移 | `.file-row/.rail-task/.nav-item:hover` |
| 输入聚焦 | 边框变 accent + 3px 柔和环 | `.text-input:focus` |
| 选中 | accent 同色系覆盖 + 左侧指示 | `.file-row.is-selected/.task-tab.is-active` |

禁止：让普通卡片 hover 漂浮、所有元素统一缩放、用发光表达 hover。

## 5. 加载：骨架 shimmer

- `.skeleton` 用渐变背景 + `rp-shimmer` 循环表达加载，`.skeleton-line/.skeleton-circle`
  对齐真实行/头像，`.skeleton-card` 组合卡片骨架。
- 骨架尺寸与真实内容一致，避免数据到达时布局跳动。
- 加载超过预期仍无结果时，要给出说明与重试，不能让骨架无限循环。

## 6. 持续反馈（仅两类）

| 类 | 动效 | 含义 |
| --- | --- | --- |
| `.attention` | 边框光晕 1.8s 呼吸 | 待用户审批/确认，需要用户行动 |
| `.live-indicator.is-live` | 光晕 2s 轻脉冲 | 连接实时，正在接收事件 |

- 待审批的 `.approval-callout` 可叠加 `.attention`，用户处理后立即移除。
- 不做全站统一脉冲、不做连续强闪烁（避免焦虑与无障碍问题）。

## 7. 状态与步骤（stepper）

- 计划步骤用 `.plan-index` 的形状变化（pending/active/done）表达进度，active 才有强调。
- 步骤切换可对当前行加 `.animate-fade`，不重排整个列表。
- 进度条 `.progress`：可量化用确定宽度，无法量化用 `.indeterminate` 并配文字。

## 8. 降级与 reduced-motion

- `prefers-reduced-motion: reduce` 时，`base.css` 统一把动画/过渡压到 1ms，直接呈现最终状态。
- 不依赖动画传达关键信息：状态、步骤、错误都有文字与形状承载。
- `backdrop-filter` 不可用时，玻璃回退为不透明 `--rp-surface`，保证可读。

## 9. 落地速查（什么时候用什么）

| 场景 | 用类 |
| --- | --- |
| 面板/区块首次进入视图 | `.animate-rise`（组用 `.stagger`） |
| 对话框/菜单/Toast 弹出 | `.animate-pop` |
| 点击按钮 | 内置 press 下沉，无需额外写 |
| 等待数据 | `.skeleton` 系列 + 容器 `aria-busy` |
| 需要用户审批 | `.approval-callout.attention` |
| 实时连接 | `.live-indicator.is-live` |
| 切换标签 | tabpanel 加 `.tab-enter` |
| 破坏性动作 | `.confirm-button` 两步确认 |
| 长内容收纳 | `.disclosure` 折叠 |
