# RepoPilot Lite 组件目录 v2（类名合同）

> 按业务语义组织，与 `apps/code-agent/src/App.tsx` 真实组件一一对应，并登记 v2 新增组件。
> 规则：组件只呈现状态并调用既有动作，不伪造运行时行为；不为每个页面新造 Card/Panel/Button 变体。

## 1. 应用壳层

| 组件 | 根类名 | 职责 | 关键状态 |
| --- | --- | --- | --- |
| `App` | `.app-shell` | 主题、全局快捷键、数据加载、氛围层、视图出口 | loading / ready / error |
| `WorkspaceRail` | `.workspace-rail` | 品牌、主导航、最近任务、设置入口 | `is-mobile-open`（移动端抽屉） |
| `ContextBar` | `.context-bar` | 仓库、分支、worktree、连接状态、命令入口 | live / offline / reconnecting / snapshot |
| `CommandPalette` | `.command-overlay` `.command-dialog` | 快速跳转、新建任务、搜索任务 | closed / open / empty |
| `EvidenceRail` | `.evidence-rail` | 任务状态、检查、风险、worktree 证据 | 桌面 sticky；窄屏转网格/单列 |

### 1.1 WorkspaceRail 内部类名

```
.rail-brand > .brand-mark + (strong + span) + .rail-close
.new-task-button（含 kbd）
.rail-nav > .nav-item[.is-active]
.rail-section-head
.task-list > .rail-empty | .rail-task[.is-active]
  .task-dot.dot-{status} + .rail-task-copy(strong + small)
.rail-spacer
.rail-footer > .workspace-identity(.avatar + strong/small) + .nav-item(设置)
```

### 1.2 ContextBar 内部类名

```
.mobile-menu（仅窄屏显示）
.context-repo > .repo-icon + strong + .context-divider + span
  + .local-badge + .runtime-badge.runtime-{mode}
.context-meta > span(GitBranch) + .worktree-state(span + 文案)
.context-actions > .command-trigger + .icon-button(主题)
```

`runtime-badge` 修饰类：`runtime-live / runtime-offline / runtime-connecting /
runtime-snapshot / runtime-reconnecting`。

## 2. 任务工作区

`TaskWorkspace`（根：`.task-layout`）= 页头 + 标签页 + 主面 + 证据栏。

### 2.1 页头与标签

```
.page-head
  .breadcrumb（.mono 显示任务 id）
  .title-row > div(.eyebrow + h1 + p) + TaskStatusBadge
  .task-meta-row > span × 4（分支/时间/文件数/事件数）
.task-tabs[role=tablist] > .task-tab[.is-active]（.tab-count 仅 review 有未决项）
```

六个 tab：`overview / plan / run / changes / checks / review`。tab 支持左右方向键切换
（`aria-selected`、漫游 `tabIndex`），不要破坏该键盘行为。切换时在 tabpanel 加 `.tab-enter`。

### 2.2 状态徽章

| 组件 | 类名 | 说明 |
| --- | --- | --- |
| `StatusBadge` | `.status-chip.status-{status}` | 含 `.status-dot` + 中文标签 |
| `TaskStatusBadge` | 同上，或 `.status-cancelled` | `undoneAt` 存在时显示"已撤销" |

`status-{status}` 全量：`queued / planning / awaiting-approval / acting / verifying /
succeeded / failed / cancelled / blocked`（下划线转连字符）。

### 2.3 各视图

| 视图 | 根类名 | 子结构 | 关键状态 |
| --- | --- | --- | --- |
| `OverviewView` | `.overview-board` | `.overview-hero` + `.metric-grid` + `.two-column-grid` | 按状态切换标题/文案 |
| `PlanView` | `.view-stack` | `.section-intro` + `.plan-panel` + `.approval-callout` | 无计划/待审批/已批准 |
| `RunView` | `.view-stack` | `.run-toolbar` + `.timeline-panel` | streaming / ended |
| `ChangesView` | `.changes-layout` | `.file-panel` + `.diff-panel` | 选中文件、空 diff、截断 |
| `ChecksView` | `.view-stack` | `.checks-panel` + `.report-panel` | 无检查/有结果/交付摘要 |
| `ReviewView` | `.view-stack` | `.findings-panel` | 无发现/有发现 |

### 2.4 视图内小构件类名

```
MetricCard:   .metric-card > .metric-icon + .eyebrow + strong + small
PanelHeader:  .panel-header > div(.eyebrow + h3) + action
PlanStepRow:  .plan-row > .plan-index.plan-{status} + div(strong+small) + .step-state.state-{status}
EventMini:    .event-mini > .event-mini-icon.tone-{tone} + div(strong+small) + time
TimelineEvent:.timeline-event > .event-marker.marker-{tone} + div + time
CheckRow:     .check-row > .check-icon.check-{status} + .check-copy + .check-duration
FindingRow:   .finding-row > .severity.severity-{level} + .finding-copy
EmptyState:   .empty-state > span(icon) + strong + p + .empty-actions
```

## 3. 状态后缀全量（实现时必须覆盖）

| 族 | 取值 | 出现位置 |
| --- | --- | --- |
| 任务状态 | queued, planning, awaiting-approval, acting, verifying, succeeded, failed, cancelled, blocked | `.status-*`、`.dot-*` |
| 事件 tone | neutral, accent, ok, warn, danger, info | `.marker-*`、`.tone-*` |
| 计划步骤 | pending, active, done | `.plan-*`、`.state-*` |
| 检查 | queued, running, passed, failed, skipped | `.check-icon.check-*`、`.check-dot.check-*` |
| 文件 kind | added, modified, deleted | `.kind-*` |
| 严重级别 | critical, high, medium, low, info | `.severity-*` |
| diff 行 | add, remove, context, header | `.diff-line.diff-*` |
| 连接 | live, offline, connecting, snapshot, reconnecting | `.runtime-badge.runtime-*` |

## 4. 反馈与恢复

| 组件 | 类名 | 规则 |
| --- | --- | --- |
| 全局错误条 | `.action-error`（`role=alert`） | 保留上下文，提供关闭按钮 |
| 连接状态面板 | `.state-panel` / `.state-panel-error` | 阶段说明 + 重试，不用旋转作为唯一反馈 |
| 空态 | `.empty-state`（含 `.empty-actions`） | 说明为什么空 + 下一步 CTA，不写"暂无数据" |
| 命令输出 | `.check-output` | 默认折叠，长输出限高可滚动，保留退出码 |

## 5. 表单、浮层、页面

### 5.1 TaskComposer（`.overlay` > `.composer-dialog`）

```
.dialog-head(.eyebrow + h2 + 关闭)
.field-label + .text-input[.has-error] + .field-hint[.is-error]
.field-label + .text-area
.mode-fieldset > .mode-grid > .mode-choice[.is-selected] × 3
.composer-note
.composer-footer > span + div(.button-quiet + .button-primary)
```

校验：标题至少 2 字符；失败时保留输入、聚焦标题、显示内联错误，不静默清空。

### 5.2 CommandPalette（`.command-overlay` > `.command-dialog`）

```
.command-search(Search + input + kbd)
.command-section > .eyebrow + .command-row（含 .task-dot / kbd）
.command-empty
```

点击遮罩或按 `Esc` 关闭；行点击后关闭并跳转。

### 5.3 独立页面

| 页面 | 根类名 | 说明 |
| --- | --- | --- |
| `WorkspaceHome` | `.view-stack` | `.home-panel` + `.home-notes`，无任务时展示 |
| `TemplateLibrary` | `.page-content.template-page` | 未实现，只给诚实空态，不放假入口 |
| `SettingsView` | `.page-content.settings-page` | `.settings-layout` > `.settings-content` > `.settings-section`，只读展示 |

## 6. 组件合同（每个组件实现前写清）

1. 数据由谁拥有（服务器事实 vs 本地 UI 状态，见 `state-and-flows.md`）。
2. 事件由谁触发，调用哪个 `runtime` 方法。
3. 必做状态：loading / empty / error / success / disabled / blocked / stale / offline。
4. 键盘、焦点、屏幕阅读器语义（见 `accessibility.md`）。
5. 窄屏布局变化（见 `page-map.md`）。
6. 需要的测试 fixture。

## 7. 组合规则（不新增平行组件）

- `TaskWorkspace` 组合：页头 + `TaskTabs` + 主视图 + `EvidenceRail`。
- `OverviewView` 组合：`overview-hero` + `MetricCard ×4` + 计划/证据两个 `section-panel`。
- `ChangesView` 组合：`file-panel` + `diff-panel`。
- `ChecksView` 组合：`checks-panel` + `report-panel`。
- 新视觉先调整语义组合与 token；确需新增类名，使用 `rp-` 前缀并在本文件登记。

## 8. v2 新增交互组件（components-v2.css）

### 8.1 玻璃面板 `.glass-panel`

```
.glass-panel（半透明 + backdrop-filter + 发丝边）
.glass-panel.strong（更不透明，用于需高可读处）
```

用于浮层、粘性条、局部面板；同一视图最多一层，不与普通面板嵌套堆叠。

### 8.2 Toast `.toast-region` > `.toast`

```
.toast > svg + .toast-copy(strong + small) + .toast-close
.toast.toast-ok / .toast-warn / .toast-danger / .toast-info
```

- 固定右下角（`z:toast`），玻璃强背景，pop 入场；用于轻反馈（已保存、已复制、已发送）。
- **不替代**页面状态、错误解释与不可逆确认；多条堆叠，自动或手动关闭，不阻塞主流程。
- 容器建议 `aria-live="polite"`；关键失败用 `role="alert"`。

### 8.3 状态带 `.status-band`

```
.band-label（eyebrow）+ .band-state（含状态点）+ .band-next（下一步说明）+ .band-cta
```

连续可见的横条，把"当前状态 + 下一步 + 可执行 CTA"放在一起；窄屏 CTA 占满一行。
适合放在任务页头下方或视图顶部，替代散落的状态文案。

### 8.4 两步确认 `.confirm-button`

```
默认态（.confirm-button）→ 第一次点击加 .armed（改文案、danger 配色）→ 第二次点击才执行
```

- armed 文案必须含对象与后果（如"确认删除 src/a.ts？"）；失焦或按 `Esc` 复位。
- 不自动倒计时、不自动执行；用于删除、拒绝、撤销等破坏性动作。
- 键盘可完成两步，也可取消；armed 期间焦点不离开按钮。

### 8.5 折叠 `.disclosure`（原生 `details/summary`）

```
.disclosure > summary（含 .chevron）+ .disclosure-body
```

保留原生键盘与 `aria-expanded` 语义；chevron 随展开旋转；用于长输出、风险明细、附加说明。

### 8.6 工具提示 `.has-tooltip` > `.tooltip-bubble`

hover 或 `focus-within` 显示，仅补充信息（快捷键、含义），不承载关键状态；
窄屏/触控不可 hover 时，关键信息须有可见替代。

### 8.7 进度条 `.progress` > `.progress-bar`

- 确定态：用 `width:%` 表达真实比例，过渡平滑。
- 不确定态：`.progress.indeterminate`，进度条往返，仅用于无法量化的等待，且配合文字说明。

### 8.8 骨架 `.skeleton`（基础在 motion.css）

```
.skeleton（块）/ .skeleton-line（行）/ .skeleton-circle（圆）
.skeleton-card > .skeleton-title + .skeleton-line × n
```

加载时用骨架占位，结构与真实内容对齐；数据到达即移除，不用骨架伪装已完成。
