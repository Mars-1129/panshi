# 提示词 02 · 用 v2 素材包重构（核心）

> 直接复制以下内容发给执行 Agent。这是一次性治理的主提示词。

```text
你是资深设计工程师。请用 ui-kit-v2 素材包重构 RepoPilot Lite 的前端，消除多套视觉系统，
让 ui-kit-v2 成为唯一权威。保持现有 React 组件结构、类名与业务逻辑，不换框架、不装新依赖。
v2 保留蓝紫身份，新增受控玻璃、氛围层、动效、骨架与反馈组件；不要引入金色与衬线。

【先读】
ui-kit-v2/SKILL.md、references/design-system.md、references/component-catalog.md、
references/motion-and-interaction.md、references/page-map.md、references/state-and-flows.md、
references/iconography.md、references/accessibility.md。

【落地样式，二选一并说明理由，最后必须在浏览器验证可加载】
方案 A（推荐，直接用聚合入口）：
  在 apps/code-agent/src/main.tsx 顶部 import（相对路径以实际位置为准，
  src 到仓库根是 ../../../）：
    ../../../ui-kit-v2/css/styles.css
  styles.css 已按顺序聚合 tokens→base→motion→components→components-v2→layout。
  停用并删除旧的 import "./styles.css"。若 Vite 报 fs.allow 越界，改用方案 B。
  （如聚合 @import 在你的构建里不生效，改为逐个 import 上述六个文件，顺序不变。）
方案 B（复制进 app，自包含）：
  把 ui-kit-v2/tokens 与 ui-kit-v2/css 整体复制到 apps/code-agent/src/styles/，
  保持 tokens/ 与 css/ 的相对关系；main.tsx 改为 import "./styles/css/styles.css"。
  停用旧 src/styles.css。

【引入字体】
在 apps/code-agent/index.html <head> 加入（保留系统字体回退，离线不阻塞）：
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
确认没有任何衬线字体残留（删除 Noto Serif SC 相关引用），不引入金色。

【清理与对齐】
1. 新样式只含 var(--rp-*)，确认无裸 hex、无临时 color-mix、无重复 @media。
2. 玻璃仅单层、配发丝边；确认 backdrop-filter 含 -webkit- 前缀，并提供不透明回退；
   氛围层固定不滚动、不压内容，且不随状态改色温。
3. 用 TS/编辑器“未使用引用”检查，确认后清理未使用的 lucide 导入；删除前先核实。
4. 主题保持 localStorage["rp-theme"]，挂到 <html data-theme>；确认浅色 :root、深色 data-theme 生效。
5. 不改变任何 runtime 调用、事件处理与 view-model 逻辑；如发现 UI 假状态，按素材包改为诚实状态。
6. 破坏性动作（删除/拒绝/撤销）改为两步确认；Toast 仅用于轻反馈，不替代错误解释与确认。

【验证，全部通过才算完成，并记录结果】
- pnpm --dir apps/code-agent typecheck
- pnpm --dir apps/code-agent build
- pnpm --dir apps/code-agent test
- pnpm --dir apps/code-agent dev，在浏览器核对明暗主题、375/768/1024/1440 宽度、
  六个 tab、时间线、diff、检查、空态、骨架、Toast 与两步确认；可对照 ui-kit-v2/preview/index.html。
- 开启系统 reduced-motion，确认无残留持续动画。

【交付】列出改动文件、采用的落地方案、验证命令结果、仍存在的限制。
```
