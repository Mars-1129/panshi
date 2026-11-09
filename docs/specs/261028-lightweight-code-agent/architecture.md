# 架构设计

## 1. 总体原则

### 1.1 参考当前工作区，但不复制其规模

当前 Blade Agent 的 `core → host → server → runner` 分层适合大型平台，但轻量 Coding Agent 第一版应压缩为：

```text
Core Domain → Agent Runtime → Tools/Workspace → CLI/API
```

只有当任务并发、远程执行和团队协作成为真实需求时，才拆出 Server、Queue 和 Runner。

### 1.2 Agent 负责判断，平台负责确定性能力

模型负责：理解目标、选择上下文、制定计划、决定下一步工具、解释结果。

平台负责：路径解析、Git 隔离、文件补丁、命令执行、超时、输出限制、测试状态、审批和事件持久化。

### 1.3 计划和执行分离

Plan 阶段只读，不修改文件；Act 阶段按已确认计划操作。计划发生重大漂移时，暂停并重新请求审批。

## 2. 逻辑分层

### `core`

只包含与模型和界面无关的领域类型：

- `Task`
- `Run`
- `RunState`
- `Plan`
- `ToolCall`
- `Approval`
- `PatchSet`
- `CheckResult`
- `Finding`
- `Artifact`
- `AgentEvent`

### `context`

负责仓库理解：

- 规则文件发现和优先级。
- 项目类型、入口和依赖识别。
- 目录树和仓库地图。
- 文件、符号、测试和配置检索。
- 上下文裁剪、去重和压缩。

### `tools`

只暴露窄而清晰的工具：

- `repo_list`
- `repo_search`
- `repo_read`
- `repo_patch`
- `git_status`
- `git_diff`
- `exec`
- `test`

工具必须返回结构化结果，不能把原始终端输出直接当成唯一状态来源。

### `runtime`

负责：

- LLM Provider 适配。
- Agent Loop。
- Plan/Act 状态转换。
- 轮数、Token、耗时和补丁大小预算。
- 工具调用和审批调度。
- 失败重试和有限修复循环。
- 事件流和运行恢复。

### `workflows`

把产品模式表达为策略，而不是复制多套 Agent：

- `GenerateWorkflow`
- `ReviewWorkflow`
- `FixWorkflow`
- `TestWorkflow`
- `ScaffoldWorkflow`

它们共享 Context、Tools、Runtime 和 Verification，区别只在初始权限、提示约束和验收规则。

### `adapters`

- `cli`：第一入口。
- `http`：可选本地 API。
- `web`：后续本地控制台。
- `ide`：后续 VS Code/JetBrains 集成。

## 3. 推荐运行拓扑

```text
┌──────────────────────┐
│ CLI / Local Web       │
└──────────┬───────────┘
           │ typed commands/events
┌──────────▼───────────┐
│ Agent Runtime         │
│ plan / act / verify   │
└─────┬─────────┬───────┘
      │         │
┌─────▼───┐ ┌───▼────────┐
│ Context  │ │ Workflows  │
└─────┬───┘ └───┬────────┘
      └────┬────┘
┌───────────▼───────────┐
│ Tools + Worktree       │
│ FS / Git / Exec / Test │
└───────────┬───────────┘
            │
┌───────────▼───────────┐
│ Local repository       │
└────────────────────────┘
```

## 4. 执行隔离

第一版使用 Git worktree：

1. 检查用户工作区是否有未提交变更。
2. 创建任务专属 worktree 或临时分支。
3. Agent 只在该目录读写和执行命令。
4. 结束时生成 diff、测试报告和 checkpoint。
5. 用户自行选择应用、提交或丢弃变更。

Docker 沙盒应作为 `ExecutionBackend` 的后续实现，而不是第一版核心假设。

## 5. 技术建议

- 语言：TypeScript/Node，方便共享 CLI、API 和 Web 类型。
- 包管理：pnpm workspace。
- 模型接口：OpenAI-compatible HTTP，保留 Provider 抽象。
- schema：Zod 或同类运行时校验。
- 搜索：优先 `rg` 和文件名/依赖索引；后续可增加 Tree-sitter/LSP。
- 状态：JSONL 事件日志；需要查询时再加 SQLite 索引。
- Git：调用系统 Git，封装跨平台参数和错误。
- 命令执行：Node 子进程封装，禁止依赖 Bash-only 语法。

## 6. 与当前 Blade Agent 的边界

如果最终放入当前仓库，建议先放在 `apps/code-agent/`，只依赖公开 SDK 或协议，不导入 `ba/internal`、`host` 或 `server` 内部模块。

可以复用：

- 事件记录思想。
- Context contribution 的分层思路。
- Skills/规则文件作为可版本化资产。
- Tool metadata 和结构化结果。
- CLI、SDK、Web 共用类型。

不直接复用：

- Blade Agent 的业务路由和会话数据库。
- Server/Runner 的生产分布式生命周期。
- 面向聊天产品的角色、房间、连接器和用户时间线语义。
- 现有产品 Prompt、界面文案、组件实现或测试样例。
