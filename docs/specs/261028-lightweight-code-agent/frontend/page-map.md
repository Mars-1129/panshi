# 页面地图与响应式职责

## 路由

| 路由 | 页面 | 职责 |
| --- | --- | --- |
| `/` | `WorkspaceHome` | 当前仓库、最近任务、待审批、失败检查、快速开始 |
| `/tasks/new` | `NewTaskPage` | 创建任务并生成计划，不直接写入 |
| `/tasks/:taskId` | `TaskWorkspace` | 任务总览、计划、运行、变更和检查的统一容器 |
| `/tasks/:taskId/review` | `ReviewPage` | 只读审查 diff，输出 findings |
| `/templates` | `TemplateLibrary` | 脚手架模板、版本、变量和验证命令 |
| `/settings` | `SettingsPage` | 模型、命令策略、主题、快捷键和本地路径 |

## 页面骨架

### 工作区首页

```text
ContextBar
PageHeader: 当前仓库 + 新建任务
┌──────────────┬────────────────────────────┐
│ recent tasks │ pending approvals/checks   │
└──────────────┴────────────────────────────┘
```

### 任务工作区

```text
ContextBar
TaskHeader + status + primary action
TaskTabs: Overview / Plan / Run / Changes / Checks
main surface + EvidenceRail
```

### 审查页

```text
ReviewHeader: base revision + changed files
ChangeTree | DiffViewer | FindingList
```

## 视觉场景

本产品不使用 OmniDirector 的 `data-scene` 语义。只保留三种前端环境层：

- `workspace`：默认工作台，背景最安静。
- `review`：强调差异、发现和证据，降低装饰。
- `setup`：脚手架和配置，突出表单和校验。

场景只改变背景层和辅助图形，不能改变交互合同、状态色和组件语义。

## 响应式

| 宽度 | 结构 | 处理 |
| --- | --- | --- |
| `>=1200` | 左 rail + 主面 + 右 rail | 全部显示，右 rail 可固定 |
| `768–1199` | 折叠 rail + 主面 + sheet | 证据 rail 通过按钮打开 |
| `<768` | 单列 + tab | 主动作固定在安全区，详情进入 sheet |
| `<480` | 单列紧凑 | 命令输出和 diff 支持局部横向滚动 |

## 页面状态

- 空仓库：说明仓库未识别到什么，提供“创建任务”或“选择目录”。
- 计划生成中：显示当前阶段和取消入口。
- 待审批：显示动作、影响和权限范围。
- 运行中：时间线滚动，但不抢夺键盘焦点。
- 断线：保留已知状态，显示重连进度，不伪装成失败。
- 失败：保留输入、命令、退出码和下一步。
- 完成：显示结果、验证证据、风险和继续修复入口。
