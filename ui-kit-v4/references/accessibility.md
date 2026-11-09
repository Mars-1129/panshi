# 可访问性规范 v2（Accessibility）

> 底线：WCAG 2.1 AA。目标是键盘、屏幕阅读器、色觉障碍和 reduced-motion 用户都能完成核心任务。

## 1. 语义与地标

- 使用语义化地标：`header / main / aside / nav / footer`；`aside` 与 `nav` 提供 `aria-label`。
- 每个页面只有一个描述性 `h1`，标题层级有序（h1 → h2 → h3），不跳级。
- 列表用 `ul/ol`，证据用 `table`，按钮用 `button`，输入用 `input`。

## 2. 名称、角色、状态

- 所有交互控件具备可访问名称：按钮配文字或 `aria-label`；输入配 `<label htmlFor>`。
- 纯图标按钮必须有 `aria-label`；对话框用 `role="dialog"` + `aria-modal` + `aria-labelledby`。
- 标签页用 `role=tablist/tab/tabpanel`、`aria-selected`、`aria-controls`，配合漫游 tabindex。
- 折叠用原生 `details/summary`（自带 `aria-expanded`）；选中态用 `aria-pressed`/`aria-selected`。

## 3. 焦点管理

- 所有可聚焦元素有清晰 `:focus-visible`（2px 外环、2px 偏移），不被 sticky/浮层遮挡。
- 打开对话框/抽屉时把焦点移入，关闭后归还触发元素；模态内提供焦点陷阱。
- tab 顺序与视觉和任务顺序一致；自动滚动/流式更新不抢焦点。
- 两步确认 armed 期间焦点不离开按钮，`Esc` 可复位。

## 4. 实时区域与提示

- 异步状态更新用 `aria-live="polite"` 或 `role="status"`；Toast 区域默认 `polite`。
- 错误用 `role="alert"`（`.action-error`、连接错误面板、关键失败 Toast）。
- 错误信息关联到对应字段（`aria-describedby`、`aria-invalid`）。
- 工具提示（tooltip）不承载关键信息，且可通过键盘 focus 触发。

## 5. 不依赖颜色

- 任何状态都有非颜色线索：图标、形状、位置或文字。
- 链接/可交互元素除颜色外还有形状等区分；armed 态同时改变文案与配色。
- 对比度满足 AA：正文约 4.5:1，大字号约 3:1；玻璃上的文字若不达标，改用 strong 背景。

## 6. 键盘可达

- 全功能可仅用键盘完成：`Ctrl/Cmd+K`、`Esc`、方向键切 tab、`Enter` 确认。
- 破坏性动作有两步确认，且键盘可触发与取消；disclosure 用键盘可开合。
- 触控目标 ≥44×44px；紧凑工具栏保留可操作间距。

## 7. 动效与媒体

- 尊重 `prefers-reduced-motion`：`base.css` 把动画/过渡降到 1ms，直接呈现最终状态。
- 持续脉冲仅用于待确认/实时点，且 reduced-motion 下消失。
- 命令输出/diff 可键盘滚动，不造成页面整体横向溢出。

## 8. v2 组件专项检查

| 组件 | 必查项 |
| --- | --- |
| Toast | 容器 `aria-live`；可手动关闭；不遮挡焦点与 CTA；不自动消失关键错误 |
| 状态带 | 状态有非颜色线索；CTA 键盘可达；窄屏顺序合理 |
| 两步确认 | armed 可被 Esc/失焦复位；第二次点击才执行；屏幕阅读器能感知状态变化 |
| 折叠 | 原生语义；chevron 不重复表达（设 `aria-hidden`）；内容可被朗读 |
| 工具提示 | 键盘 focus 可触发；关键信息另有可见替代 |
| 进度条 | 不确定态配文字说明；不仅靠动画表达等待 |
| 骨架 | 加载区域标注 `aria-busy`；数据到达后正确移除 |

## 9. 验收检查

- 用键盘完整走一遍：首页 → 新建任务 → 审批 → 运行 → 变更 → 检查（含两步确认）。
- 屏幕阅读器（NVDA / VoiceOver）确认地标、标题、对话框、Toast 与 live 提示被正确朗读。
- 375/768/1024/1440 + 明暗主题下检查对比度与 reflow。
- 开启 reduced-motion 验证无残留持续动画。
