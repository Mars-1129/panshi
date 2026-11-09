# 提示词 07 · 对话式重构（chat-first，Gemini CLI 专用）

> 用途：让 Gemini CLI 依据 ui-kit-v3 与 07–10 对话概念图，把当前"监控 dashboard"式前端
> 重构为**对话式 AI 编码协作者**。Gemini 原生多模态，可直接打开 PNG 看图。
> 直接复制下面整段发给 `gemini`（TUＩ）；任务大时一次只做一个阶段。
> 非交互运行加 `--skip-trust`，例如 `gemini --skip-trust -p "<整段>"`。

## 主提示词（可直接复制）

```text
你是资深产品前端工程师，负责把 RepoPilot 的现有前端从"Agent 运行监控台"重构为"对话式 AI 编码协作者"。
技术栈固定为 React 19 + Vite 6 + TypeScript + lucide-react，包管理器是 pnpm。
不要换框架、不要装新依赖、不要改后端与 runtime 契约、不要重写已经正确的逻辑。
前端源码在 apps/code-agent/src（App.tsx 是当前类名权威，runtime.ts 是服务器事实源，
types.ts 定义全部数据类型，lib/view-model.ts 负责派生），设计资产在 ui-kit-v3/。
产品定位与 MVP 边界以根目录 repopilot-product-reposition.md 为准。

【背景：为什么要改】
当前界面首屏是系统状态、用 LIVE/OFFLINE/遥测/证据这类运维语言、信息架构是旁观执行的多 tab 监控面板，
像后台监控而不是用户产品。目标是 chat-first：用户用自然语言交代目标，Agent 在隔离沙箱规划、
求授权、执行并自检，把可审查的改动交付给用户，全程可对话、可审批、可撤销。

【两条最高原则，任何冲突都以它们为准】
1. 布局、层级、间距关系、材质、状态编码：严格照 ui-kit-v3/concepts/ 下 07–10 四张对话概念图，
   先读 concepts/README.md 的逐张读图要点。你具备多模态能力，逐张打开 PNG 看图，
   不允许自由发挥、不允许"按你的审美优化"、不允许发明图里没有的组件。
   01–06 是旧监控布局，只参考其材质与配色，绝不照抄其三栏监控布局。
2. 任何颜色、字号、字重、圆角、间距、阴影、模糊：只能引用 var(--rp-*)，
   禁止裸 hex、禁止从图里吸色、禁止临时 color-mix、禁止尺度外数值。
   对话组件类名以 references/chat-components.md 为准，不得自造类名。

【数据与契约前提（先确认，不要臆造）】
- 现有数据 plan、planSteps、events、checks、files、diff、findings、status、error 全部现成，
  后端契约不变，本次只做呈现层重组；先通读 types.ts 弄清每个字段的含义和取值。
- 动效、Toast、骨架、armed、composer 展开态、活动行折叠态都是本地 UI 状态，不改变服务器事实。
- v2 的 .app-shell 六 tab 结构被 .chat-workspace 统一流取代；v2 类名保留但不再用于主界面。
- 复用 v2 的 .button-*、.confirm-button、.toast、.icon-button、.disclosure、.diff-line，
  不重复造按钮/确认/Toast 变体。

【阶段 0 · 只审计与设计映射，不改代码，先产出方案】
依次读：ui-kit-v3/SKILL.md、concepts/README.md、references/chat-components.md、
tokens/tokens.css、css/components-v3.css，并逐张查看 concepts/07..10 四张图；
再通读 apps/code-agent/src 全部源码与 types.ts，输出一份结构化方案，至少包含：
  - "现有数据 → 对话元素"映射表：每个字段（plan/events/checks/files/diff/findings/status/error）
    分别对应哪个对话组件（消息 / .inline-card / .activity / .inline-check / .product-dock）
  - 现有 .app-shell 各 tab 的内容，哪些并入统一对话流、哪些下沉到产物侧栏、哪些移到设置页
  - 运维语言清单（LIVE/OFFLINE/遥测/证据/监控等）与建议的用户语言替换文案
  - 风险点：有无字段缺失、有无现有逻辑依赖被改的布局、需要保留的交互（审批/两步确认/Toast）
  - 静态检查：现存裸 hex、自造类名、自定义 SVG、emoji 图标（grep 给文件与行号）
等我确认方案后再进入分阶段修改，不要在阶段 0 直接改文件。

【分阶段重构，每阶段：先复述要改的点与类名/token → 修改 → 自测 → 再进下一阶段】
阶段 1 · 对话工作台外壳（对照 07-chat-welcome-light.png）
  用 .chat-workspace（grid 三段：顶栏/主体/composer）替换主界面骨架；
  .chat-topbar（.topbar-brand/.topbar-context/.topbar-status.is-live，连接只用弱化小圆点，
  不用 LIVE 徽章）+ .chat-body（.chat-scroll>.chat-thread 限宽 --rp-chat-max 居中）；
  明暗共用同一结构，仅靠 <html data-theme> 切 token；保留氛围层与受控玻璃。
阶段 2 · 欢迎空态与常驻 composer（对照 07）
  .chat-welcome（.welcome-mark + h2 + p）+ .suggestion-grid>.suggestion-chip（点击填入 composer）；
  底部 .chat-composer-area>.composer-bar（.composer-tools + .composer-input 自适应高度 +
  .composer-send），Enter 发送 / Shift+Enter 换行，发送按钮有 disabled 态；首屏不出现系统状态/遥测。
阶段 3 · 消息与内联计划/审批卡（对照 08-chat-approval-dark.png）
  .msg.msg-user（右，--rp-bubble-user-bg）与 .msg.msg-agent（左，--rp-bubble-agent-bg）；
  .inline-card.card-plan：.inline-card-head + .step-list>.step-item.step-{pending|active|done|failed}
  （.step-glyph 状态字形 + .step-copy）+ .affected-files>.file-pill；
  .inline-card.card-approval：.approval-actions 内 .button-primary（Allow once，一次性语义）
  + .button-secondary（Reject）；决议后加 .is-resolved 弱化并隐藏按钮；
  破坏性动作仍走 .confirm-button 两步确认（armed 可 Esc/失焦复位，第二次点击才执行）。
阶段 4 · 可折叠活动行与内联检查（对照 08、09）
  events 用原生 details/summary 的 .activity[.is-running]：summary 一行摘要 +
  .activity-chevron/.activity-spinner，默认收起，.activity-detail>pre 限高滚动、等宽字体；
  checks 用 .inline-check.check-{queued|running|passed|failed|skipped}（.check-glyph + .check-duration）。
阶段 5 · 产物侧栏（对照 09-chat-product-dock.png）
  .product-dock（--rp-product-width）：.dock-head + .dock-body（.dock-file[.is-selected]
  用 .kind-{added|modified|deleted} 着色 + .dock-diff 复用 diff 行着色 + 检查汇总）；
  <1024 时转为覆盖抽屉，.is-dock-open 滑入，带关闭按钮。
阶段 6 · 移动端与全面验收（对照 10-chat-mobile.png）
  单列堆叠，.topbar-context 隐藏，底部 composer 常驻，触控目标 ≥44px，产物以抽屉拉出；
  核对 375/768/1024/1440 宽度、明暗、键盘可达、焦点可见、reduced-motion 无持续动画。

【硬性禁止，出现即返工】
- 裸 hex、平行视觉系统、临时 color-mix、自定义尺寸/圆角/字重、从图里吸色。
- 自定义 SVG 图标、emoji 当图标、引入新图标库；图标只用 lucide-react 且继承 currentColor
  （preview 静态页里的内联 SVG 仅用于预览，React 实现里一律用 lucide-react）。
- 首屏放系统健康/遥测/监控；用 LIVE/OFFLINE 徽章；工具活动默认展开。
- 玻璃堆叠、整页玻璃化、卡片持续脉冲；玻璃须单层、发丝边、带 -webkit- 前缀与不透明回退。
- 假计时器、假数据、伪造运行成功、无法执行的假入口；未实现给诚实空态。
- 一次点击直接执行删除/拒绝/撤销；危险动作必须两步确认；审批不得写成永久 allow。
- 为深色另写一套布局或类名、多主题运行时注入；引入新依赖、换框架、改后端/契约。

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

- **先让它只做阶段 0**：确认"数据→对话元素"映射和 IA 重组方案，再授权改代码，避免一上来大面积改动。
- **一次只推进一个阶段**，每阶段对照对应概念图人工看一眼再继续。
- 图内文字是占位，**最终文案以代码与产品方案为准**；模型纠结图中文字时，让它忽略文字、只还原结构。
- 若模型写裸 hex、想加依赖或想保留监控布局，直接回："删掉，用现有 var(--rp-*) / lucide，不新增东西，
  主界面按 07–10 走统一对话流"，不接受"这样更简单"的解释。
- 当前默认模型 gemini-3.6-flash 稳定；重模型在当前代理易超时，若某阶段输出被截断，拆小任务重发。
- 非交互运行若提示目录未信任，加 `--skip-trust` 或设 `GEMINI_CLI_TRUST_WORKSPACE=true`。
