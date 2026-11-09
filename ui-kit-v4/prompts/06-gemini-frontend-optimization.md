# 提示词 06 · 前端优化对齐（Gemini CLI 专用）

> 用途：让 Gemini CLI 对照 ui-kit-v2 素材包与 6 张高保真概念图，先审计现有 App.tsx，
> 再分阶段把前端优化、对齐到设计系统。Gemini 原生多模态，可直接读取 concepts/*.png 看图。
> 直接复制下面整段发给 `gemini`（TUI）或 `gemini -p "<整段>"`；任务大时一次只做一个阶段。

## 主提示词（可直接复制）

```text
你是资深前端工程师，负责审计并优化 RepoPilot Lite 的现有前端，使其严格对齐 ui-kit-v2 设计系统。
技术栈固定为 React 19 + Vite 6 + TypeScript + lucide-react，包管理器是 pnpm。
不要换框架、不要装新依赖、不要改后端与 runtime 契约、不要重写已经正确的逻辑。
前端源码在 apps/code-agent/src（App.tsx 是类名权威，runtime.ts 是服务器事实源，
lib/view-model.ts 负责派生），设计资产在 ui-kit-v2/。

【两条最高原则，任何冲突都以它们为准】
1. 布局、层级、间距关系、材质、状态编码：严格照 ui-kit-v2/concepts/ 下的 6 张概念图，
   先读 concepts/README.md 的逐张读图要点。你具备多模态能力，逐张打开 PNG 看图，
   不允许自由发挥、不允许"按你的审美优化"、不允许发明图里没有的组件。
2. 任何颜色、字号、字重、圆角、间距、阴影、模糊：只能引用 var(--rp-*)，
   禁止裸 hex、禁止从图里吸色、禁止临时 color-mix、禁止尺度外数值。
   类名以 references/component-catalog.md 为准，不得自造类名。

【阶段 0 · 只审计，不改代码，先产出差距清单】
依次读：ui-kit-v2/SKILL.md、concepts/README.md、references/design-system.md、
references/component-catalog.md、references/page-map.md、references/state-and-flows.md、
references/iconography.md、references/accessibility.md、references/motion-and-interaction.md、
tokens/tokens.css，并逐张查看 concepts/01..06 六张图。
再通读 apps/code-agent/src 全部源码，输出一份结构化审计报告，至少覆盖：
  - 裸 hex / 平行视觉系统 / 临时 color-mix / 尺度外数值（全局 grep，给出文件与行号）
  - 类名是否都在 component-catalog 内、有无自造类名、有无未使用或重复的样式
  - 图标：是否只用 lucide-react 且继承 currentColor、有无自定义 SVG、emoji 当图标、未使用的 lucide 导入
  - 明暗：是否共用同一套类名、仅靠 <html data-theme> 切 token，有无为深色另写布局/类名
  - 玻璃是否单层受控、带 -webkit- 前缀与不透明回退；氛围层是否固定不滚动、不压内容
  - 破坏性动作是否两步确认、Toast 是否只做轻反馈、空态是否诚实（无假数据/假计时器/假入口）
  - 响应式断点（1200/860/640）、触控目标 ≥44px、键盘可达、焦点可见、WCAG AA、prefers-reduced-motion
  - 字体栈：确认 --rp-font-mono 末尾是中文回退（"Microsoft YaHei UI"/"Microsoft YaHei"），无裸 monospace
报告按"必须修复 / 建议优化 / 已符合"三档分组，每条给文件路径、行号与对应规范依据；
等我确认后再进入分阶段修改，不要在阶段 0 直接改文件。

【分阶段优化，每阶段：先复述要改的点与类名/token → 修改 → 自测 → 再进下一阶段】
阶段 1 · 应用骨架（对照 01-app-frame-light.png、02-app-frame-dark.png）
  对齐 .app-shell 三栏：.workspace-rail(248) + .context-bar(56) + 主工作面 + .evidence-rail(300)，
  挂载网格与光晕氛围层；明暗共用类名，仅靠 data-theme 切 token。
阶段 2 · 计划与审批（对照 03-plan-approval.png）
  .status-band + .plan-panel(.plan-row，plan-done/active/pending) + .approval-callout；
  Allow once 用 .button-primary，Reject 用 .button-secondary；
  破坏性动作必须 .confirm-button 两步确认（armed 可 Esc/失焦复位，第二次点击才执行）。
阶段 3 · 运行轨迹（对照 04-trajectory.png）
  .run-toolbar（搜索 + 来源过滤）+ .timeline-panel，按 turn 分组、.timeline-event 用
  marker-{neutral/accent/ok/warn/danger/info}，工具调用用 .disclosure 可展开，命令用等宽字体，
  长列表虚拟滚动，运行中更新不抢焦点。
阶段 4 · diff 与检查（对照 05-diff-checks.png）
  .changes-layout 下 .file-panel + .diff-panel(.diff-line.diff-add/remove/context/header) +
  .checks-panel(.check-row，check-passed/failed/running/queued/skipped)；
  面板内可横向滚动，页面整体不横向溢出。
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
- 引入新依赖、换框架、改后端/契约。

【每阶段自测，全部通过才进入下一阶段，并记录真实结果】
- pnpm --dir apps/code-agent typecheck
- pnpm --dir apps/code-agent build
- pnpm --dir apps/code-agent test
- 浏览器核对该阶段对应的图：浅色 + 深色、375/768/1024/1440 宽度、键盘可达、焦点可见；
  开启系统 reduced-motion 确认无持续动画。
- 全局搜索确认没有新增裸 hex（grep "#[0-9a-fA-F]{3,6}"），没有未使用的 lucide 导入。

【交付】按阶段列出：改动文件、用到的类名与 token、对照的是哪张图、验证命令结果、遗留限制。
不要把未验证项写成完成；和图不一致的地方要明确指出差异，不要静默带过。
```

## 给发任务者的使用建议（不必发给模型）

- **先让它只做阶段 0 审计**，人工确认差距清单后再授权修改，避免它一上来大面积改动。
- **一次只推进一个阶段**，每阶段对照对应概念图人工看一眼再继续。
- 图内英文是占位，**最终文案以 App.tsx 现有文案为准**；若模型纠结图中文字，让它忽略文字、只还原结构。
- 若模型写了裸 hex 或想加依赖，直接回："删掉，改用现有 var(--rp-*) / lucide，不新增东西"，
  不接受"这样更简单"的解释。
- 最终验收可独立再跑一次 `prompts/04-qa.md`，不要让同一个模型自己验收自己。
