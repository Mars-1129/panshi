# RepoPilot Lite 实现状态

最后更新：2026-10-29 · 里程碑 M1「可信闭环」

本文件只记录**已实现 / 未实现 / 已知限制**。产品目标与设计见
[`specs/261028-lightweight-code-agent/`](specs/261028-lightweight-code-agent/)。

## 已实现

| 能力 | 说明 | 证据 |
| --- | --- | --- |
| 仓库识别 | 语言、包管理器、`package.json` scripts、入口、基线 revision | [`server/core/repo.ts`](../apps/code-agent/server/core/repo.ts) |
| 计划先于批准 | 创建任务后异步生成计划；批准必须匹配 `plan.hash` | [`runtime.ts`](../apps/code-agent/server/core/runtime.ts) `planTask` / `approve` |
| 审批与拒绝 | `approve` / `reject` / `cancel`，非法迁移被拒绝 | [`lifecycle.ts`](../apps/code-agent/server/core/lifecycle.ts) |
| worktree 隔离 | `git worktree add .repopilot/worktrees/<id> -b rp/<id>` | [`git.ts`](../apps/code-agent/server/core/git.ts) |
| checkpoint / undo | 初始 checkpoint + 每次写入后 checkpoint；`undo` 回到指定 commit | 同上 `checkpoint` / `resetTo` |
| 工具循环 | `repo_list/search/read/write`、`git_status/diff`、`exec`、`finish`、`report_findings` | [`tools.ts`](../apps/code-agent/server/core/tools.ts) |
| 预算 | 12 轮、4 次写入、2 次修复循环、120s/命令、64KB 输出、512KB diff | [`config.ts`](../apps/code-agent/server/core/config.ts) |
| 真实检查 | 真实执行命令并记录 exit code、stdout/stderr、耗时、超时 | [`checks.ts`](../apps/code-agent/server/core/checks.ts) |
| 成功门禁 | 需要 ≥1 个通过且 0 个失败、非空 diff、写入后 checkpoint；无检查即失败 | `runtime.ts` `hasEvidence` |
| 事件日志 | JSONL、单调 seq、游标读取、断线重连、重启恢复 | [`event-log.ts`](../apps/code-agent/server/core/event-log.ts) |
| 只读审查 | 禁用写入与命令；必须真实读取仓库并调用 `report_findings` | `runtime.ts` `runReview` |
| HTTP/SSE | Origin/Host 校验、`X-RepoPilot-Request`、64KB body、SSE id 与终态关闭 | [`http.ts`](../apps/code-agent/server/http.ts) |
| CLI | `plan/run/status/diff/undo/review`，退出码 0/1/3 | [`cli/index.ts`](../apps/code-agent/cli/index.ts) |
| Web | 任务列表、计划、事件时间线、真实检查、diff、报告、undo；空/加载/错误/离线态 | [`src/App.tsx`](../apps/code-agent/src/App.tsx) |
| 任务级磁盘锁 | `acquireTaskLock` 独占创建锁文件；跨进程互斥，陈旧锁（进程已死）可接管 | [`task-lock.ts`](../apps/code-agent/server/core/factory/task-lock.ts) |
| 运行取消 | `POST /stages/cancel` 中止运行；当前工段跑完后停止，后续工段不再执行 | `runtime.ts` `cancelFactory` |
| 自定义检查 | `.repopilot/checks.json` 声明的检查命令优先于自动推断；配置无效时告警并回落 | [`custom-checks.ts`](../apps/code-agent/server/core/custom-checks.ts) |
| 规则文件注入 | `AGENTS.md` / `.repopilot/rules.md` / `CLAUDE.md` 按序注入系统提示词 | [`project-rules.ts`](../apps/code-agent/server/core/project-rules.ts) |
| 沙箱执行后端 | `REPOPILOT_SANDBOX=docker` 时命令在一次性容器内执行；不可用则如实阻断，不回落宿主机 | [`sandbox.ts`](../apps/code-agent/server/core/sandbox.ts) |
| 前端组件测试 | jsdom + Testing Library，`src/**/*.test.tsx` 与后端 node 测试分 project 运行 | [`vitest.config.ts`](../apps/code-agent/vitest.config.ts) |
| 测试 | 242 个单元与集成用例，全部离线 | [`tests/`](../apps/code-agent/tests) |

## 未实现（UI 如实标注）

- 模板脚手架与模板库（模板页显示「本版本未实现」，无入口）。
- 测试生成模式（composer 只提供 generate / fix / review）。
- MCP / ACP / IDE 集成、Docker 或远程执行后端。
- 多 run、暂停/恢复、轨迹回放、CI JSONL 输入。
- 虚拟化、语法高亮、Monaco、视觉系统重绘。

## 已知限制

- JSONL 事件日志是运行事实来源；`meta.json` 快照在写失败时只记录错误，由下一次成功写入补齐。
- `exec` 依赖命令白名单，白名单外的合法构建工具需要显式扩展。
- 修复循环把失败输出整体交给模型，模型可能重复同一错误；预算耗尽后任务失败并保留证据。
- Windows 上 worktree 删除可能因文件锁失败，会重试三次再 `worktree prune`。
- `new/API.txt` 中的历史密钥仍在磁盘上，请轮换后删除；运行时已不再读取它。

## 新增的已知限制

- **磁盘锁只在单机同文件系统有效**，跨机器部署需要数据库行锁或分布式锁。
- **取消只在工段之间生效**：当前工段会跑完，不会立刻中断正在执行的命令。
- **沙箱是单次命令隔离，不是常驻容器池**：每次 exec 起一个容器，启动开销几百毫秒；也没有端口映射。
- **前端测试覆盖仍偏薄**：目前覆盖投影层、合并逻辑与工作流组件；`App.tsx` 的主流程、弹窗与 SSE 驱动状态仍无回归保护。

## 下一步

1. 前端主流程测试（`App.tsx` 首屏、工段切换、运行确认、弹窗）。
2. 工段 08 接 Playwright，补上浏览器巡航与 pageerror 捕获。
3. 工段 03 接 Ghidra，覆盖原生 `.so/.dll` 反编译分支。
4. 许可证与来源台账（发布前门禁）。

---

## 工厂工段后端（PanShi-SwarmFactory MVP）

最后更新：2026-11-06 · 里程碑 M0–M6（单条链路跑通）

### 入口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/runtime/tasks/:id/stages` | 十个工段的 StageRun |
| POST | `/api/runtime/tasks/:id/stages/:n/run` | 运行单个工段；5/6 需 `{"confirm": true}` |
| POST | `/api/runtime/tasks/:id/stages/run-all` | 0–8 顺序执行后汇总 9（写文件工段需 confirm） |
| GET | `/api/runtime/tasks/:id/artifacts` | 产物清单 |
| GET | `/api/runtime/tasks/:id/artifacts/:aid` | 产物内容 |
| GET | `/api/runtime/tasks/:id/contracts` | 三份契约 + 校验 + 哈希 + 锁定状态 |

事件契约在 `shared/contracts.ts`（40 个工厂事件），所有工厂事件都带 `stageId` 与 `stageRunId`；存储沿用
`.repo-agent/runs/<taskId>/{stages,artifacts,contracts,generated,reports}`，不触碰用户工作区。

### 各工段真实程度

| 工段 | 实现 | 状态 |
| --- | --- | --- |
| 0 接入基线 | 资产清单 + SHA-256、基线 revision、敏感信息扫描（掩码）、环境摘要 | 真实 |
| 1 环境救活 | 复制到隔离工作区、执行真实构建命令、记录退出码与错误分类 | 真实 |
| 2 业务考古 | TypeScript Compiler API 切片 + 调用图 + 规则（含文件/行号）；非 TS/JS 进未分析项 | 真实（语言受限） |
| 3 二进制对拍 | 读 `blackbox.json`：wasm 黑盒用 Node 原生加载，1000 组确定性差分对拍；原生二进制需 Ghidra；无黑盒时 `not_applicable` | 真实（wasm）/ 不适用 |
| 4 技能封装 | 本地 MCP server `tools/list` 自省 → SKILL.md + wrapper → Harness 正例/异常用例 | 真实 |
| 5 需求/契约 | 三份契约生成 + 结构校验 + 哈希 + 版本锁定（需 confirm） | 真实 |
| 6 多角色制造 | Database / Backend / Frontend 并发写入独立目录后合并；预算按生成字节计 | 真实 |
| 7 护栏 | Judge 读取实现源码被真实拒绝；路由/RBAC/锚点静态校验 | 真实 |
| 8 双擎质检 | 50 并发库存超卖 → 不变量判定 → 蓝军修复 → 复测；Playwright 巡航 `blocked` | 真实（巡航阻断） |
| 9 RSI 交付 | 交付报告 + 证据链 + Evolution SkillPack + SkillHub PR 草稿 | 真实 |

### 已知边界

- 工段 3 需要目标二进制与 Ghidra Headless，本机不具备，按"未执行"阻断，不生成等价结论。
- 浏览器巡航需要 Playwright，当前只完成接口级红蓝对抗，UI 巡航标为 blocked。
- 角色预算按生成字节计量，不是 token 计量。
- 工厂运行以"逐工段显式确认"作为审批模型；M1 的计划审批（planHash）仍只用于旧 Agent loop。
- 未实现：审批台账、来源台账、越权专项报告、断点续跑的真实 UI 联动。

### 本地验证

```bash
pnpm --dir apps/code-agent typecheck && pnpm --dir apps/code-agent test && pnpm --dir apps/code-agent build
REPOPILOT_PROVIDER=fake REPOPILOT_REPO=../samples/legacy-procurement node server/main.ts --port=4185
# 另开终端：
curl -X POST http://127.0.0.1:4185/api/runtime/tasks -H "X-RepoPilot-Request: 1" -H "Content-Type: application/json" -d '{"title":"验收","summary":"","mode":"generate"}'
curl -X POST http://127.0.0.1:4185/api/runtime/tasks/<id>/stages/run-all -H "X-RepoPilot-Request: 1" -H "Content-Type: application/json" -d '{"confirm":true}'
```

---

## M7：审批、原型与台账闭环（2026-11-07）

在 MVP 全链路上补齐了六项此前"未覆盖/空态"的后端契约，前端全部有对应展示：

| 能力 | 事件 / 产物 | 前端位置 |
| --- | --- | --- |
| 人工审批记录 | `approval.requested` / `approval.resolved`（Stage 5 契约锁定、Stage 6 角色执行） | 工段 05 状态条「人工审批 N 条」；工段 09 统计「人工介入」与台账页脚 |
| 可点击原型 | `prototype.ready` + `prototype.html`（7 个锚点、路由与 RBAC） | 工段 05 状态条「原型已生成 · 7 个锚点」 |
| 护栏统计 | `rail.stats`（关卡数 / 检查项 / 阻断数） | 工段 07 头部「7 道关卡 · 检查 20 项 · 阻断 N 条」 |
| 权限检查 | `judge.permission`（生成路由 vs 契约 RBAC，静态） | 工段 08 裁判面板「权限检查（静态）· 5/5 通过」 |
| 来源与许可证台账 | `source.ledger` + `source-ledger.json` | 工段 09「来源与许可证」卡片（含未知许可证告警） |
| 交付报告增强 | `delivery.report` 增加 `approvals[]` | 工段 09 统计与台账 |

工段 05/06 的确认现在不仅放行写入，还会留下可审计的批准记录；工段 09 的「人工介入」不再是 0。

仍未覆盖（见前端"后端对接"清单，35 已渲染 / 2 空态 / 6 未覆盖）：

- 工段 01：依赖冲突表（需要真实安装树）、环境修复 diff；
- 工段 03：原生 `.so/.dll` 的 Ghidra 反编译尚未接入（wasm 黑盒的对拍已跑通）；
- 工段 05：需求澄清对话；
- 工段 06：角色重试记录（当前无失败重试场景）；
- 工段 08：Playwright 追踪、截图与 pageerror（依赖未安装）。

测试：`pnpm test` 151 passed（10 个测试文件，新增加工段 03 黑盒对拍、不适用语义、工厂汇总用例）。
