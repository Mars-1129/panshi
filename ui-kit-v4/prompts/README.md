# 执行提示词 v4 · 使用总览

这组提示词让编码 Agent（GPT / Claude / Gemini / Codex 等）严格按照 `ui-kit-v4` 素材包执行，
而不是自由发挥。每个文件都是可直接复制粘贴的完整提示词。

## 执行顺序

| 顺序 | 文件 | 用途 | 何时用 |
| --- | --- | --- | --- |
| 1 | `01-audit.md` | 审计现有 UI，列出与素材包的偏差 | 重构前，先摸清现状 |
| 2 | `02-refactor.md` | 用素材包替换混乱样式、引入字体、清理死代码 | 一次性治理 |
| 3 | `03-new-feature.md` | 新增页面/组件时按包执行 | 后续每次新功能 |
| 4 | `04-qa.md` | 视觉、动效与可访问性验收 | 每次交付前 |
| 5 | `05-codex-from-mockups.md` | 照概念图分阶段还原 | Codex 看图执行 |
| 6 | `06-gemini-frontend-optimization.md` | 对照素材审计并优化对齐 | Gemini 做视觉优化 |
| 7 | `07-gemini-chat-first-rebuild.md` | 重构为对话式（chat-first） | 对话界面 |
| 8 | `08-codex-factory-frontend.md` | **工厂全链路前端：工段/角色/7锚点/契约/攻防/巡航/证据，含 data-panshi-id 纪律** | **本轮主任务，Codex 分阶段执行** |

## 通用铁律（所有提示词都隐含）

1. 只消费 `ui-kit-v2/tokens/tokens.css` 中的 `var(--rp-*)`，禁止裸 hex、平行视觉系统。
2. 玻璃受控（单层、发丝边、可降级）；氛围不压内容；持续脉冲仅给待确认/实时点。
3. 不伪造运行时状态：服务器事实只来自 `runtime.ts`/SSE，经 `view-model.ts` 派生；动效/
   Toast/骨架/armed 是本地状态。
4. 破坏性动作两步确认；Toast 只做轻反馈；状态 = 文字 + 图标/形状 + 颜色。
5. 不引入新依赖、不换框架、不改后端/契约，除非提示词明确授权。
6. 每步改完跑 `typecheck`、`build`、`test`，并在浏览器真实渲染验证（含明暗与动效）。
7. 未实现给诚实空态，不放假入口；失败保留输入和恢复路径。

## 素材包地图（提示词中引用的路径）

```text
ui-kit-v4/
├─ SKILL.md                  # 单一执行入口，先读它
├─ tokens/tokens.css         # 权威 token（明暗双主题，v3 超集 + 工厂 token）
├─ css/
│  ├─ base.css               # reset/排版/焦点/滚动条
│  ├─ motion.css             # 动效层
│  ├─ components.css         # 基础组件
│  ├─ components-v2.css      # v2 交互组件
│  ├─ components-v3.css      # v3 对话组件
│  ├─ components-v4.css      # v4 工厂组件（驾驶舱/工段/角色/业务原型/契约/攻防/巡航/证据/RSI）
│  ├─ layout.css             # 骨架/氛围/网格/响应式
│  └─ styles.css             # 聚合入口
├─ references/               # 含 factory-components 与 panshi-anchor-discipline
├─ concepts/                 # 14 张概念图（11–14 工厂主界面）+ 读图索引
├─ preview/                  # 可交互风格指南
└─ prompts/                  # 本目录
```
