# RepoPilot 对话组件目录 v3（chat-first 类名合同）

> v3 = v2 全量超集。本文件登记新增的对话式组件，与 `repopilot-product-reposition.md` 配套。
> 规则不变：组件只呈现状态并调用既有动作，不伪造运行时行为；所有值取 `var(--rp-*)`，
> 不新增裸 hex、不新增依赖、不自定义 SVG；图标统一 lucide-react。
> 数据全部来自现有 `types.ts` 字段，后端契约不变，只改呈现层。

## 1. 对话工作台外壳

| 组件 | 根类名 | 职责 | 关键状态 |
| --- | --- | --- | --- |
| `ChatWorkspace` | `.chat-workspace` | 顶栏 + 对话主体 + 常驻 composer 的 grid 容器 | 明暗、reduced-motion |
| `ChatTopBar` | `.chat-topbar` | 品牌、仓库/分支、弱化连接状态 | `.topbar-status.is-live / .is-reconnecting` |
| `ChatBody` | `.chat-body` | 对话流 + 产物侧栏两列 | <1024 单列 |
| `ChatScroll` | `.chat-scroll` | 对话流滚动容器 | 自动滚到底部 |
| `ChatThread` | `.chat-thread` | 统一流，限宽居中（`--rp-chat-max`） | — |
| `ProductDock` | `.product-dock` | 产物侧栏：变更树 + diff + 检查 | `.is-dock-open`（窄屏抽屉） |
| `ComposerArea` | `.chat-composer-area` | 常驻 composer 容器 | — |

### 1.1 顶栏内部类名

```
.chat-topbar
  .topbar-brand > .brand-mark + 文字
  .topbar-context（仓库/分支，窄屏隐藏）
  .topbar-spacer
  .topbar-status[.is-live|.is-reconnecting] > .status-dot + 文案
  + 主题切换 icon-button（沿用 v2）
```

连接状态只用小圆点 + 文案，**不再用 LIVE/OFFLINE/遥测徽章**。

## 2. 欢迎空态（首屏）

```
.chat-welcome
  .welcome-mark（图标）
  h2 + p（价值主张）
  .suggestion-grid > .suggestion-chip × 4（含 svg + 文案，点击填入 composer）
```

首屏不展示运行时健康/遥测/写入上限；这些下沉到设置页。

## 3. 消息行

| 组件 | 类名 | 结构 |
| --- | --- | --- |
| 用户消息 | `.msg.msg-user` | `.msg-avatar` + `.msg-copy`（`.msg-meta` + `.msg-bubble`） |
| Agent 消息 | `.msg.msg-agent` | 同上，方向相反 |

- 用户消息右对齐、强调气泡；Agent 消息左对齐、表面气泡。
- 消息行带 `rp-rise` 入场；reduced-motion 下禁用。

## 4. 内联卡片（统一流核心）

根类：`.inline-card`，修饰类 `.card-{plan|approval|check|finding|error}`，
决议后加 `.is-resolved`（弱化、隐藏操作按钮）。

```
.inline-card
  ::before（左侧状态条，语义色）
  .inline-card-head > .head-icon + strong + .head-state
  .inline-card-body
```

| 卡片 | 修饰类 | 状态条颜色 | 数据来源 |
| --- | --- | --- | --- |
| 计划卡 | `.card-plan` | accent | `plan` + `planSteps` |
| 审批卡 | `.card-approval` | warn | `status === awaiting_approval` |
| 检查卡 | `.card-check` | ok | `checks` |
| 发现卡 | `.card-finding` | info | `findings` / `report` |
| 错误卡 | `.card-error` | danger | `error` |

### 4.1 计划卡内步骤

```
.step-list > .step-item.step-{pending|active|done|failed}
  .step-glyph（状态字形：空心/旋转/对勾/叉）
  .step-copy（标题 + small 说明）
.affected-files > .file-pill（mono，含文件路径）
```

### 4.2 审批卡操作

```
.approval-actions
  Allow once = .button-primary（一次性授权，非永久 allow）
  Reject = .button-secondary
破坏性动作仍走 .confirm-button 两步确认（v2 规则）。
```

## 5. 可折叠工具活动（默认收起）

```
.activity[.is-running]（原生 details/summary）
  summary > 图标 + .activity-summary（一行，如"执行了 4 个工具"）
           + .activity-spinner（运行中）+ .activity-chevron
  .activity-detail > pre（参数/命令输出，限高滚动，mono）
```

- 工具/命令/系统事件（`events`）默认折叠，只显示一行摘要，按需展开。
- 保留原生 `aria-expanded` 与键盘；展开状态按会话持久化。

## 6. 内联检查

```
.inline-check.check-{queued|running|passed|failed|skipped}
  .check-glyph（图标/旋转）+ 名称 + .check-duration
```

## 7. 常驻 Composer

```
.chat-composer-area
  .composer-bar
    .composer-tools（附件/模式，icon-button）
    .composer-input（textarea，自适应高度，Enter 发送 / Shift+Enter 换行）
    .composer-send（圆形/圆角，accent，disabled 态）
  .composer-hint（快捷键/边界说明）
```

## 8. 产物侧栏

```
.product-dock[.is-dock-open]
  .dock-head（strong + 窄屏 .dock-close）
  .dock-body
    .dock-file[.is-selected]（.kind-{added|modified|deleted} 着色 + 路径）
    .dock-diff（复用 diff 行着色，限高滚动）
    检查汇总（复用 .inline-check）
```

## 9. 状态后缀全量（实现时必须覆盖）

| 族 | 取值 | 出现位置 |
| --- | --- | --- |
| 顶栏连接 | live, reconnecting | `.topbar-status.is-*` |
| 卡片类型 | plan, approval, check, finding, error | `.inline-card.card-*` |
| 计划步骤 | pending, active, done, failed | `.step-item.step-*` |
| 工具活动 | running（+ open 由 details 管理） | `.activity.is-running` |
| 检查 | queued, running, passed, failed, skipped | `.inline-check.check-*` |
| 文件 kind | added, modified, deleted | `.dock-file .kind-*` |
| 消息方向 | user, agent | `.msg.msg-*` |

## 10. 组合规则（不新增平行组件）

- `ChatWorkspace` = `ChatTopBar` + `ChatBody`（`ChatThread` + `ProductDock`）+ `ComposerArea`。
- `ChatThread` 内按时间顺序组合：消息、`.inline-card`、`.activity`。
- 现有 v2 的 `.app-shell` 六 tab 结构被 `.chat-workspace` 统一流取代；v2 类名保留但不再用于主界面。
- 复用 v2 的 `.button-*`、`.confirm-button`、`.toast`、`.icon-button`、`.disclosure`、`.diff-line`、
  不重复造按钮/确认/Toast 变体。
- 确需新增类名，使用语义化命名并在本文件登记。

## 11. 硬约束（验收红线）

1. 只消费 `var(--rp-*)`，禁止裸 hex、自定义阴影/圆角、从图里吸色。
2. 图标统一 lucide-react、继承 currentColor；不画自定义 SVG、不用 emoji。
3. 工具活动/证据默认折叠，首屏是任务输入而非系统状态。
4. 危险动作两步确认；错误有内联解释（非仅 Toast）；空态诚实，无假数据/假计时器/假入口。
5. 触控目标 ≥44px、WCAG AA、键盘可达、`prefers-reduced-motion` 生效、明暗共用同一结构。
6. 不新增依赖、不改后端契约；`pnpm --dir apps/code-agent typecheck / build / test` 必须通过。
