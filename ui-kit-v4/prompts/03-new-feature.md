# 提示词 03 · 新增页面/组件 v2

> 每次做新功能前，把下面内容连同你的具体需求一起发给执行 Agent。

```text
你要在 RepoPilot Lite 中实现以下需求：【在此填写具体需求】。
必须严格遵循 ui-kit-v2 素材包，先读 ui-kit-v2/SKILL.md 和相关 references，再动手。

【硬性要求】
1. 只使用 ui-kit-v2/tokens/tokens.css 的 var(--rp-*)；禁止裸 hex、平行视觉系统、
   新 UI 库/图标库/依赖（确有必要先说明并征得同意）。
2. 先复用现有类名与组件模式（references/component-catalog.md）；确需新类名，用 rp- 语义
   前缀并在 component-catalog 登记，不造新的 Card/Panel/Button 变体。
3. 数据只来自 runtime.ts/SSE，经 view-model 派生；组件不伪造服务器事实、不用假计时器；
   动效/Toast/骨架/armed 是本地状态，不改变数据。
4. 完整实现 loading/empty/error/success/disabled/blocked/offline；加载用结构对齐的骨架，
   未实现给诚实空态，不放假入口。
5. 反馈遵循 references/motion-and-interaction.md：只动 transform/opacity；按钮 press 下沉、
   主按钮 hover 轻抬；持续脉冲仅给待确认/实时点；玻璃单层受控、可降级。
6. 破坏性动作两步确认（armed 可 Esc/失焦复位，第二次点击才执行）；Toast 只做轻反馈。
7. 一个屏幕一个主动作；状态同时有文字 + 图标/形状 + 颜色；图标用 lucide，纯图标按钮加 aria-label。
8. 布局遵循断点 1200/860/640，代码/diff 允许局部横向滚动、页面整体不横向溢出；满足
   references/accessibility.md 的键盘与 ARIA 要求。

【实现顺序】先确认数据来源与组件合同 → 写标记与样式 → 接入状态、事件与动效 → 验证。

【验证】typecheck、build、test 全过；浏览器核对明暗主题、375/768/1024/1440 宽度、
reduced-motion，并在交付说明里列出改动文件、复用/新增的 token 与类名、验证结果和遗留限制。
```
