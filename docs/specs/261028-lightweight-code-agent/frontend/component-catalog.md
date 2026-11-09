# 前端组件目录

组件按照业务语义组织，不按“看起来像卡片/面板”重复造组件。

## 应用壳层

| 组件 | 职责 | 关键状态 |
| --- | --- | --- |
| `AppShell` | 主题、布局、全局快捷键、路由出口 | booting / ready / disconnected |
| `WorkspaceRail` | 仓库、任务、模板、设置和最近运行导航 | collapsed / selected / unread |
| `ContextBar` | 当前仓库、分支、worktree、连接状态 | clean / dirty / detached / offline |
| `CommandPalette` | 快速跳转、创建任务、搜索文件和命令 | closed / open / loading / empty |
| `EvidenceRail` | 审批、检查、风险、交付摘要 | hidden / pinned / blocked |

## 任务工作区

| 组件 | 职责 | 关键状态 |
| --- | --- | --- |
| `TaskComposer` | 输入任务、选择模式、范围和验证要求 | idle / validating / submitting / error |
| `TaskHeader` | 任务名称、状态、仓库和主动作 | queued / running / blocked / done |
| `PlanPanel` | 文件、步骤、风险、验证命令 | draft / changed / approved / rejected |
| `ApprovalBar` | 展示待批准动作和影响 | required / approving / denied / approved |
| `RunTimeline` | 事件、工具、命令、检查的时间线 | streaming / paused / reconnecting / ended |
| `CommandOutput` | 展示命令摘要和折叠输出 | running / passed / failed / truncated |
| `ChangeTree` | 文件变更和验证状态 | loading / selected / filtered / empty |
| `DiffViewer` | 文件级 diff 和 checkpoint 比较 | loading / ready / binary / too-large |
| `CheckList` | 测试、Lint、类型、构建检查 | queued / running / passed / failed / skipped |
| `FindingList` | 审查问题及证据 | none / findings / dismissed / resolved |
| `DeliveryReport` | 交付摘要、风险、导出和下一步 | draft / complete / incomplete |

## 反馈和恢复

| 组件 | 规则 |
| --- | --- |
| `EmptyState` | 说明为什么为空，提供下一步；不只显示“暂无数据” |
| `ErrorCard` | 保留用户输入，给出原因、重试和查看详情 |
| `StatusChip` | 文字 + 图标/形状 + 颜色；可选 `aria-live` |
| `CheckpointMenu` | 比较、恢复、命名和删除 checkpoint；删除要确认 |
| `ConfirmDialog` | 明确对象、后果和取消路径；Escape 可关闭 |
| `Toast` | 只做短暂补充，不代替页面状态或错误详情 |

## 组件合同

每个组件在实现前写清：

- 数据由谁拥有。
- 事件由谁触发。
- loading/empty/error/success/disabled/stale 状态。
- 键盘、焦点和屏幕阅读器语义。
- 移动端布局变化。
- 需要的测试 fixture。

## 组合规则

- `TaskWorkspace` 组合 `TaskHeader + TaskTabs + EvidenceRail`。
- `RunView` 组合 `RunTimeline + CommandOutput + ApprovalBar`。
- `ChangesView` 组合 `ChangeTree + DiffViewer + FindingList`。
- `ChecksView` 组合 `CheckList + ErrorCard + DeliveryReport`。
- 不为每个页面创建新的 `Card`、`Panel` 或 `Button` 变体；先调整语义组合和 token。
