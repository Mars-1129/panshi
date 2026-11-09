# 提示词 05 · 照概念图还原（Codex 专用）

> 用途：Codex 前端/视觉能力弱，给文字规范容易自由发挥。本提示词把 6 张高保真概念图
> （`concepts/`）作为"长什么样"的事实源，把 `var(--rp-*)` 作为"用什么值"的唯一来源。
> 直接复制下面整段发给 Codex；任务较大时让它按"阶段"逐个落地，每阶段验证后再继续。

## 主提示词（可直接复制）

```text
你是前端实现工程师，负责把 RepoPilot Lite 的界面按给定概念图还原。你的视觉判断不可靠，
所以本任务提供了 6 张高保真概念图。技术栈固定为 React 19 + Vite 6 + TypeScript + lucide-react，
不要换框架、不要装新依赖、不要改后端与 runtime 契约。

【两条最高原则，冲突时以它们为准】
1. 布局、层级、间距关系、材质、状态编码：严格照 ui-kit-v2/concepts/ 下的图，
   先读 concepts/README.md 的逐张读图要点，不允许自由发挥、不允许"按你的审美优化"。
2. 任何颜色、字号、字重、圆角、间距、阴影、模糊：只能引用 var(--rp-*)，
   禁止裸 hex、禁止从图里吸色、禁止临时 color-mix、禁止尺度外数值。
   图里没有的组件不要发明；类名以 references/component-catalog.md 为准。

【阶段 0 · 先读，再动手】
依次读：ui-kit-v2/SKILL.md、concepts/README.md、references/component-catalog.md、
references/page-map.md、tokens/tokens.css。
然后用一句话复述整体三栏结构（左 248 / 顶 56 / 右 300）和明暗切换方式，确认无误再写代码。
顺手修复一个已确认 bug：tokens.css 里 --rp-font-mono 末尾是裸 monospace，会让 Windows
代码块中文回退到宋体；改为在等宽栈后补中文等宽回退（如 "SFMono-Regular", "Cascadia Code",
"Microsoft YaHei UI" 等，具体以现有字体栈风格为准），不要保留裸 monospace 结尾。

【分阶段实现，每个阶段：先复述结构与类名/token → 实现 → 自测 → 再进下一阶段】
阶段 1 · 应用骨架（对照 01-app-frame-light.png、02-app-frame-dark.png）
  还原 .app-shell 三栏：.workspace-rail(248) + .context-bar(56) + 主工作面 + .evidence-rail(300)，
  挂载 ::before 网格与 ::after 光晕氛围层；明暗共用同一套类名，仅靠 data-theme 切 token。
阶段 2 · 计划与审批（对照 03-plan-approval.png）
  .status-band + .plan-panel(.plan-row, plan-done/active/pending) + .approval-callout；
  Allow once 用 .button-primary（一次性授权），Reject 用 .button-secondary，
  破坏性动作必须 .confirm-button 两步确认（armed 可 Esc/失焦复位，第二次点击才执行）。
阶段 3 · 运行轨迹（对照 04-trajectory.png）
  .run-toolbar（搜索 + 来源过滤）+ .timeline-panel，按 turn 分组、.timeline-event 用
  marker-{neutral/accent/ok/warn/danger/info}，工具调用用 .disclosure 可展开，命令用等宽字体，
  长列表虚拟滚动，运行中更新不抢焦点。
阶段 4 · diff 与检查（对照 05-diff-checks.png）
  .changes-layout 下 .file-panel + .diff-panel(.diff-line.diff-add/remove/context/header) +
  .checks-panel(.check-row, check-passed/failed/running/queued/skipped)；面板内可横向滚动，
  页面整体不横向溢出。
阶段 5 · 移动端（对照 06-mobile.png）
  <640 时 .workspace-rail 隐藏、由 .mobile-menu 拉出 .is-mobile-open 抽屉，内容单列堆叠，
  底部 composer，触控目标 ≥44px；断点只写在 layout.css，不另造 @media。

【硬性禁止，出现即返工】
- 裸 hex、平行视觉系统、临时 color-mix、自定义尺寸/圆角/字重。
- 自定义 SVG 图标、emoji 当图标、引入新图标库；图标只用 lucide-react 且继承 currentColor。
- 玻璃堆叠、整页玻璃化、所有卡片持续脉冲/漂浮；玻璃须单层、发丝边、带 -webkit- 前缀与不透明回退。
- 假计时器、假数据、伪造运行成功、无法执行的假入口；未实现给诚实空态。
- 一次点击直接执行删除/拒绝/撤销；必须两步确认。
- 多主题运行时注入、为深色另写一套布局或类名。

【每阶段自测，全部通过才进入下一阶段，并记录结果】
- pnpm --dir apps/code-agent typecheck
- pnpm --dir apps/code-agent build
- pnpm --dir apps/code-agent test
- 浏览器核对该阶段对应的图：浅色 + 深色、375/768/1024/1440 宽度、键盘可达、
  焦点可见；开启系统 reduced-motion 确认无持续动画。
- 全局搜索确认没有新增裸 hex（grep "#[0-9a-fA-F]{3,6}"），没有未使用的 lucide 导入。

【交付】按阶段列出：改动文件、用到的类名与 token、对照的是哪张图、验证命令结果、遗留限制。
不要把未验证项写成完成；和图不一致的地方要明确指出差异，不要静默带过。
```

## 给 Codex 的使用建议（发任务的人看，不必发给模型）

- **一次只让它做一个阶段**，做完对照图人工看一眼再继续，别一次性丢 6 张图让它整包改。
- 图内英文是占位，**最终文案以 `App.tsx` 现有文案为准**；若 Codex 纠结图中文字，让它忽略文字、只还原结构。
- 若 Codex 仍写了裸 hex 或想加依赖，直接回："删掉，改用现有 var(--rp-*) / lucide，不新增东西"，
  不要接受它"这样更简单"的解释。
- 最终验收用 `prompts/04-qa.md` 独立跑一遍，不要让 Codex 自己验收自己。
