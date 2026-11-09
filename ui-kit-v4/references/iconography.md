# 图标规范 v2（Iconography）

## 1. 唯一图标来源：lucide-react

- 全项目统一使用 `lucide-react`（已在依赖中），不引入第二套图标库、不混用风格。
- 禁止用 Emoji 充当功能图标；禁止自造 SVG 与 lucide 并列。
- lucide 是线性（stroke）图标，默认 `strokeWidth={2}`，保持默认，不填充、不改描边。

## 2. 尺寸收敛

| 尺寸 | 用途 |
| --- | --- |
| 11–15px | 内联指示、时间线/事件标记、小标签 |
| 16–17px | 导航、列表行、按钮内图标（默认档） |
| 18px | 移动端菜单、对话框关闭 |
| 20–22px | 空态、状态面板、Toast 主图标、首页主图标 |

- 同组对等控件图标尺寸一致，不因文案长短改大小。
- 图标默认继承 `currentColor`，颜色由所在元素 token 决定，不写死颜色。

## 3. v2 新组件的图标约定

| 组件 | 图标 | 说明 |
| --- | --- | --- |
| Toast 成功 | `CheckCircle2` | 配合 `.toast-ok`，图标取 ok 色 |
| Toast 警告 | `TriangleAlert` | 配合 `.toast-warn` |
| Toast 失败 | `CircleX`（或 `AlertCircle`） | 配合 `.toast-danger` |
| Toast 信息 | `Info` | 配合 `.toast-info` |
| 状态带 | 复用 `.status-dot`（形状） | 不额外加 lucide，避免重复 |
| 折叠 | `ChevronRight`（作为 `.chevron`） | 展开旋转 90° |
| 两步确认 | 默认动作用原图标；armed 后可加 `TriangleAlert` | 文案优先，图标辅助 |

## 4. 可访问性

- 纯图标按钮（`.icon-button`、`.toast-close`）必须提供 `aria-label`。
- 装饰性图标设 `aria-hidden`；承载信息的图标其含义在相邻文案中可获得。
- 图标不作为唯一信息通道：状态同时有文案/形状，不依赖图标或颜色。

## 5. 语义选择原则

- 一个动作固定一个图标，全项目复用（批准=Check、关闭=X、撤销=Undo2）。
- 状态点（`.task-dot/.status-dot/.check-dot`）是形状而非 lucide，用于快速扫视。
- 优先文字标签；图标能显著加快识别时才用，不把图标当装饰、不放进彩色瓷砖。

## 6. 现有图标清单（复用，勿重复导入）

`App.tsx` 当前从 `lucide-react` 导入：

```text
AlertCircle, ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCircle2,
ChevronDown, ChevronRight, CircleDashed, Clock3, Code2, Command, Copy,
FileCode2, FilePlus2, Files, FolderGit2, GitBranch, GripVertical, History,
LayoutTemplate, ListChecks, LoaderCircle, LockKeyhole, Menu, Moon,
MoreHorizontal, PanelRight, Play, Plus, RefreshCw, Search, Settings2,
ShieldCheck, Sparkles, Sun, TerminalSquare, TestTube2, TimerReset,
TriangleAlert, Undo2, X, Zap
```

- 新增图标先在清单里找；v2 若需 `CircleX / Info` 等，确认未导入后再补，不重复 import。
- 加载旋转统一用 `LoaderCircle` + `.spin`，不用假计时器驱动的进度图标。
- 部分图标可能未在 JSX 使用，用编辑器"未使用引用"检查确认后再清理，删除前先核实。
