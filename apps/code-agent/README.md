# PanShi-SwarmFactory 前端（apps/code-agent）

政企软件工厂驾驶舱：十个工段（Stage 0–9）的链路导航、业务原型（7 个 `data-panshi-id` 锚点）、
契约审查、多角色网格、护栏链、红蓝攻防、浏览器巡航与证据交付。数据只来自 Runtime/SSE，
未接入的工段显示诚实阻断态。

视觉分两层：

1. `ui-kit-v4/css/styles.css`：组件与 token 的唯一权威；
2. `src/panshi.css`：政企视觉层（政务蓝、4–8px 圆角、系统中文栈、字阶与栅格配平），
   只覆写 token 与度量，规则见 `ui-kit-v4/references/gov-visual-language.md`。

页面不引用任何外部字体或 CDN，离线与内网环境可直接运行。

交互约定（详见 `ui-kit-v4/references/gov-visual-language.md`）：

- 桌面按 1600×900 / 1440×900 设计，**一屏不滚动**；输入/输出产物、契约正文、工段产物清单等细节走弹窗；
- 每个工段一个主视觉（驾驶舱 / 契约+链路 / 原型 / 角色栅格 / 护栏 / 双擎质检 / 证据交付），不共用同一套骨架；
- 引导入口：工段 00 的首次使用条、每页「下一步」、顶栏 `?` 与页脚的「使用引导 / 后端对接」；
- 「后端对接」弹窗按工段列出 43 条 MVP 产物缺口（已渲染 / 空态 / 未覆盖）与建议的事件字段。

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 `http://127.0.0.1:4173/`。

## Runtime API

开发服务器内置一个轻量 Runtime adapter：

```text
GET  /api/runtime/health
GET  /api/runtime/tasks
POST /api/runtime/tasks
GET  /api/runtime/tasks/:id
POST /api/runtime/tasks/:id/approve
GET  /api/runtime/tasks/:id/events   # SSE
GET  /api/runtime/tasks/:id/patches
GET  /api/runtime/tasks/:id/checks
```

硅基流动密钥只在 Vite Node 侧读取：

1. 优先使用 `SILICONFLOW_API_KEY`。
2. 未设置时读取工作区根目录的 `API.txt`。
3. 浏览器永远不会接触密钥。

模型默认使用 `deepseek-ai/DeepSeek-V4-Flash`，可以通过 `SILICONFLOW_MODEL` 覆盖。硅基流动使用 OpenAI-compatible Chat Completions API；运行时会生成真实计划，并通过 SSE 推送任务事件、检查结果和终态。

## 当前 MVP 边界

- Task/Run/Event/Check 已有本地 Runtime adapter 和 SSE 通道。
- 计划生成接入真实硅基流动模型。
- Patch 已在受限 `runtime-workspace` 中真实写入计划文件，并记录 Patch 元数据；正式部署时应把 workspace 根目录和权限策略迁移到独立 execution backend。
- Check 会验证写入文件存在；如果 workspace 是 Git 仓库，会额外执行 `git diff --check`。
- Runtime adapter 是开发期单进程实现，正式部署时应迁移到独立 API/Runner 服务。

不要将 `API.txt`、`.env` 或任何包含密钥的文件提交到版本库。
