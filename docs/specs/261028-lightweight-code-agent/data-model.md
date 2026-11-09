# 数据模型与事件协议

## 1. 核心实体

### Task

用户希望完成的业务目标。

```json
{
  "id": "task_01",
  "mode": "fix",
  "prompt": "修复登录测试失败",
  "workspace": "C:/repo",
  "createdAt": "2026-10-28T00:00:00Z"
}
```

### Run

一次实际执行。一个 Task 可以有多次 Run，但每次 Run 都必须绑定一个明确的 worktree 和模型配置。

字段建议：

- `runId`
- `taskId`
- `status`: `queued | planning | awaiting_approval | acting | verifying | succeeded | failed | cancelled`
- `worktreePath`
- `baseRevision`
- `model`
- `budget`
- `startedAt` / `endedAt`

### Plan

计划是可审查对象，不是只存在于 Prompt 中的临时文本。

- 目标和验收条件。
- 修改文件及原因。
- 执行步骤。
- 验证命令。
- 风险和假设。
- 计划版本。

### PatchSet

每次写入对应一个补丁集：

- `patchId`
- `checkpointId`
- 文件操作列表。
- 原始 hash。
- 新 hash。
- unified diff。
- 是否经过审批。

### CheckResult

- 命令。
- 工作目录。
- 退出码。
- 标准输出和错误输出。
- 输出是否截断。
- 耗时。
- 解析出的测试数量、失败数量和错误分类。

### Finding

代码审查结果：

- `severity`: `critical | high | medium | low | info`
- `path`
- `line`
- `title`
- `evidence`
- `impact`
- `recommendation`
- `confidence`

## 2. 事件格式

每行一个 JSON 事件，追加写入 `.repo-agent/runs/<run-id>.jsonl`。

```json
{
  "seq": 18,
  "runId": "run_01",
  "time": "2026-10-28T00:03:12.120Z",
  "type": "command.finished",
  "payload": {
    "command": "pnpm test --filter auth",
    "exitCode": 1,
    "durationMs": 18342,
    "stdout": "...",
    "stderr": "...",
    "truncated": false
  }
}
```

推荐事件类型：

```text
task.created
repo.detected
context.selected
plan.created
approval.requested
approval.resolved
tool.started
tool.finished
patch.created
checkpoint.created
command.started
command.finished
verification.started
verification.finished
finding.created
run.paused
run.resumed
run.succeeded
run.failed
run.cancelled
```

## 3. 状态转换约束

- `planning` 不能直接写文件。
- `awaiting_approval` 未批准时不能进入 `acting`。
- `acting` 每次写入必须产生 `patch.created` 和 `checkpoint.created`。
- `verifying` 只能运行声明过或用户批准的命令。
- `succeeded` 必须至少有一个验证结果或明确的只读审查结果。
- `failed` 必须保留最后一个工具结果和失败原因。
- 取消只阻止后续工具调用，不删除已有事件和工作区证据。

## 4. 敏感数据处理

- 事件日志默认不写入 API Key、Cookie、私钥和完整环境变量。
- 命令输出中的敏感值使用固定脱敏器处理。
- 原始日志和展示日志可以分离保存；展示日志只保留必要上下文。
- 用户明确选择导出时，再生成脱敏后的 JSON/Markdown 报告。
