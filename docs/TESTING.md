# 测试指南（PanShi-SwarmFactory / code-agent）

三层验证，从快到慢、从局部到全链路。全部命令在 `new/apps/code-agent` 下执行。

## 第 0 层 · 用户路径（手工，5 分钟）

1. 打开 http://127.0.0.1:4173 ，首屏是「从一句需求，到可交付的软件」，并显示当前工作区路径；
2. 点「新建项目」→ 选模板（会议室预约 / 设备报修 / 合同管理 / 空白）或直接填：
   - 产品名称与一句话说明；
   - 数据实体：表名（snake_case）+ 中文名 + 字段（`name:type`）；
   - 页面锚点由实体自动推导（每个实体「列表 / 新建」+ 审批时间线 / 使用统计 / 系统设置）；
3. 点「创建并运行」：服务端在 `runtime-workspace/projects/<slug>` 建 Git 仓库、写入
   `.panshi/requirement.json` 与骨架代码、切换工作区，然后自动创建运行并执行十工段；
4. 结果查看：工段 05 契约原型、06 生成代码、07 护栏、08 权限、09 交付与台账；
5. 回到「项目」列表：当前版本用工作区切换代替（`GET/POST /api/runtime/repo`），UI 尚未放项目切换器。

对应的 HTTP 接口：

```bash
curl -X POST http://127.0.0.1:4173/api/runtime/projects \
  -H "X-RepoPilot-Request: 1" -H "Content-Type: application/json" \
  -d '{"product":"设备报修系统","description":"设备台账与报修","entities":[{"table":"asset","label":"设备","fields":[{"name":"name","type":"text"}]}]}'
```

### 项目管理与工厂状态

- 右上「项目」打开项目列表：可打开或删除由工厂创建的项目；删除是两步确认，服务端会拒绝删除当前项目（`409 project_active`）；
- 「最近运行」显示**工厂状态**（工厂已完成 / 工厂阻断 N / 工厂未运行），不再被旧的计划状态（待审批/失败）覆盖；
- 任务详情接口与列表接口都会附带 `factory` 字段，由十工段结果推导，与计划审批无关。

## AI 接入（显式）

1. 右上「AI 未接入」→ 选择预设（硅基流动 / DeepSeek / OpenAI）或自定义，填 Base URL、模型、API Key；
2. 点「测试并保存」：服务端会真实调用一次 `/chat/completions` 做连通性测试，失败直接报错；
3. 密钥只保存在本机 `runtime-workspace/ai.json`，不回传浏览器；「移除」后工段自动回退确定性路径；
4. 诊断连通性：`pnpm --dir apps/code-agent probe:api`（不打印密钥）。

交付页提供契约印章（版本 + 哈希 + 锁定时间）与「打印 / 导出」按钮，打印样式会隐藏导航只保留交付内容。

当前接入模型的工段：

| 工段 | AI 行为 | 未接入/失败时 |
| --- | --- | --- |
| 02 业务考古 | 模型按切片提取规则（JSON Schema 校验，带行号），与 AST 启发式合并 | 回退 AST，并在事实面板标注「确定性 AST / 回退」 |
| 05 契约 | 仍为确定性生成（下一步接入） | — |
| 06 多角色制造 | 后端角色由模型生成 `server.mjs`（契约校验路由/RBAC，失败重试一次），DB/前端仍模板 | 回退模板，并在工段结论标注 |

## 第 1 层 · 静态与单元/集成

```bash
pnpm --dir apps/code-agent typecheck     # tsc -b，类型与契约
pnpm --dir apps/code-agent test          # vitest，151 个用例 / 15 个文件
pnpm --dir apps/code-agent build         # 前端产物 dist/
```

覆盖：事件 schema、命令白名单、路径守卫、worktree、检查与证据、undo、HTTP 路由、
工厂工段（0/1/2/4/5/6/7/8/9）、MCP 自省、契约生成与校验、红蓝对抗与修复。

## 第 2 层 · 自动化端到端（推荐先跑这个）

```bash
pnpm --dir apps/code-agent e2e
```

脚本 `scripts/e2e.ts` 会：

1. 把 `samples/legacy-procurement` 复制到系统临时目录并 `git init`（不污染工作区）；
2. 用 `REPOPILOT_PROVIDER=fake` 起真实 HTTP 服务（随机空闲端口）；
3. 创建任务 → 验证写工段未确认返回 **409 `confirmation_required`**；
4. `run-all` 跑十工段，轮询到工段 09 结束；
5. 逐项断言（22 项）：

| 断言 | 期望 |
| --- | --- |
| 工段结果 | 10 个 StageRun；9 通过 / 1 阻断 / 0 失败 |
| 阻断真实性 | 工段 03，`no_binary_target`，消息含“二进制/.so” |
| 契约 | `locked=true`，`v1`，哈希 32/64 位 hex |
| 产物 | ≥ 30 份，含 schema.sql / openapi.yaml / component_tree.json / prototype.html / source-ledger.json 等 16 个关键产物 |
| 规则 | ≥ 10 条，且每条都有 `path` + `line` |
| 事件 | ≥ 60 条；`approval.resolved` 2 条（工段 05/06） |
| 权限 | `judge.permission` 5/5 通过 |
| 护栏 | `rail.stats`：7 道关卡、检查项 > 0 |
| 台账 | `source.ledger` 4 条，1 条许可证未知 |
| 攻防 | 不变量先失败后通过，`attack.finding` 状态 `resolved` |
| 技能 | `skill.harness` 3/3 |
| 角色 | 3 个 `role.run.finished` |
| 诚实阻断 | `cruise.error` 提到 Playwright |
| 交付 | `verified=false`，阻断 1 项，人工介入 2 |
| 实时性 | SSE `/events` 首帧含 `connected` |

预期输出：`22/22 项通过`，退出码 0。失败时打印最近的服务器日志并以 1 退出。


## 第 2B 层 · 新建项目场景（"我要开发一个项目"）

```bash
pnpm --dir apps/code-agent e2e:project
```

样例：`samples/meeting-room`——只放一份需求包和少量初始代码：

```
.panshi/requirement.json   # 产品名、2 个实体、7 个锚点（id/标签/路由/RBAC/方法）
src/booking.mjs            # 初始规则（审批阈值、时段校验）
test/booking.test.mjs      # 初始测试（全部通过）
```

脚本会隔离复制样例、起真实服务、跑十工段，并断言 13 项：

| 断言 | 期望 |
| --- | --- |
| 工段 | 10 个；9 通过 / 1 阻断（工段 03 无二进制） |
| 契约 | 锁定，哈希可追溯 |
| 数据库契约 | 含 `CREATE TABLE meeting_room` / `booking`（来自需求包，不是内置模板） |
| 接口契约 | 含 `/api/meeting/calendar` 与 `rbac: [meeting:approve]` |
| 后端代码 | 7 条路由，路径与契约一致 |
| 前端代码 | 7 个 Vue 页面（每个锚点一个） |
| 原型 | 产品名「会议室预约系统」、7 个锚点、含 `booking.create` / `settings.update` |
| 权限 | 7/7 通过 |
| 契约护栏 | `ContractVerifyRail` 0 条违规 |
| 交付 | `verified=false`，保留工段 08 的浏览器巡航未执行项 |

浏览器人工验收：

```bash
REPOPILOT_REPO="../../samples/meeting-room" pnpm --dir apps/code-agent dev
```

新建运行 → 运行全链路 → 工段 05 应显示「会议室预约系统 · 7 个锚点」的契约原型
（预约日历 / 新建预约 / 审批预约 / 会议室列表 / 使用统计 / 审批时间线 / 预约规则），
而不是采购模板；工段 06 生成 7 个 Vue 页面与 7 条后端路由。

## 换成你自己的项目

1. 复制 `samples/meeting-room` 为你的项目目录；
2. 修改 `.panshi/requirement.json`：`product`、`entities`（表 + 字段）、`anchors`（3–12 个，写操作必须带 `scope`）；
3. 保留/替换 `src` 与 `test` 作为初始代码；
4. `git init && git add -A && git commit`，把 `REPOPILOT_REPO` 指向它，跑 `e2e:project` 或直接在界面里点。

不改代码即可换域；需求包是唯一的产品定义。

## 第 3 层 · 浏览器人工验收

```bash
pnpm --dir apps/code-agent dev     # http://127.0.0.1:4173，默认指向样例靶场
```

1. 右上「新建工厂运行」→ 填标题 → 创建；
2. 点「运行 MVP 全链路」→ 二次确认 → 观察左侧十工段依次点亮、SSE 显示 `LIVE`；
3. 按 `samples/legacy-procurement/README.md` 的预期表逐段核对：
   - 01 退出码 1、分类 `test`、可继续修复；
   - 02 13 条规则带 `src/approval.mjs:6` 行号；
   - 03 阻断原因（缺 `.so/.dll`）；
   - 05 契约 v1 锁定 + 原型 7 锚点 + 人工审批 2 条；
   - 06 三角色预算与产物；
   - 07 护栏统计与 2 条阻断；
   - 08 权限 5/5、红蓝 `-40 → 0`、巡航 blocked；
   - 09 交付报告、来源台账、未验证项；
4. 键盘走查：Tab 到工段与按钮，焦点可见；Esc 关弹窗；
5. 明暗切换（右上角），确认同一结构、无白底残留；
6. 宽度 375 / 768 / 1024 / 1440 各看一遍，1024 以下工段导航收成抽屉。

## 已知边界（测试覆盖不到的部分）

- **工段 03 黑盒对拍**：样例仓库用 `lib/libdepreciation.wasm` 作为黑盒，重写版经 1000 组差分对拍验证；原生 `.so/.dll` 反编译仍需 Ghidra，本机未验证；
- **浏览器巡航**：未安装 Playwright，巡航相关断言只验证 `blocked`，不验证截图/trace；
- **真实模型**：E2E 用 `fake` provider，不覆盖真实 LLM 调用与限流/超时；
- **Windows 专属**：worktree 删除重试、文件锁只在 Windows 生效。

## 常见问题

- 端口被占用：E2E 自动选空闲端口；`dev` 固定 4173，冲突时先结束占用进程；
- 4173 页面空白：看 `%TEMP%\panshi-dev.log`；若是 `package.json` 被编辑器写入 BOM，删除 BOM 即可；
- E2E 偶发失败：先重跑一次；若稳定失败，按输出里的“最近服务器日志”定位。
