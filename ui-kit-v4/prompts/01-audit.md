# 提示词 01 · UI 现状审计 v2

> 直接复制以下内容发给执行 Agent。

```text
你是资深前端设计负责人。请对 RepoPilot Lite（React 19 + Vite 6 + TS + lucide-react）
的现有 UI 做一次只读审计，不要修改任何文件。

【审计基准】
- 权威素材包：ui-kit-v2/，先读 ui-kit-v2/SKILL.md 与 references/design-system.md。
- 被审计对象：apps/code-agent/src/App.tsx、src/styles.css、index.html、src/lib/view-model.ts。

【审计任务，逐项给出结论 + 证据（文件:行号）】
1. styles.css 中存在几套互相覆盖的设计系统？列出 :root 被定义次数、各自主色与字体方向，
   以及实际生效的是哪一套、为什么；是否存在金色/衬线等已废弃方向。
2. 主题机制是否与素材包一致（浅色 :root、深色 [data-theme="dark"]）？指出相反或冲突规则。
3. 字体：声明了哪些字体？index.html 是否真正引入？离线回退到什么？是否有衬线残留。
4. 圆角、间距、断点是否统一？列出尺度外值；检查 @media 断点是否重复定义、互相覆盖。
5. 玻璃与氛围：是否有玻璃堆叠/整页玻璃化、backdrop-filter 是否含前缀与回退；氛围层是否
   压内容、是否随状态改色温；是否有让所有卡片持续脉冲/漂浮的情况。
6. 死代码：列出未使用的类名、未使用的 lucide 导入、未被引用的 CSS 规则。
7. 状态覆盖：9 任务状态、6 tone、5 检查、5 严重级别是否都有样式，缺哪些；破坏性动作是否
   有两步确认；Toast 是否被误用于关键错误/确认。
8. 可访问性：焦点、可访问名称、ARIA、live/alert、对比度、触控目标、reduced-motion 的硬伤。

【产出】
- 按“严重 / 中等 / 轻微”分级的偏差清单，每条含：问题、证据位置、对应 ui-kit-v2 规则、修复建议。
- 不要泛泛而谈，不要给没有证据的结论；只读，不改代码。
```
