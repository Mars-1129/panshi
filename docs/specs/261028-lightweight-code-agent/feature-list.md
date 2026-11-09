# 功能清单

## 优先级定义

- **P0**：MVP 必须有，缺失时不能形成可靠闭环。
- **P1**：完成个人可用和 CI 可用。
- **P2**：产品化、团队化或扩展能力。

## P0：最小可用闭环

| 分类 | 功能 | 入口 | 结果 |
| --- | --- | --- | --- |
| 会话 | 新建任务、继续任务、取消任务 | CLI | 任务 ID 和状态 |
| 仓库 | 识别语言、依赖、规则文件和测试 | 自动 | RepoSummary |
| 上下文 | 文件列表、关键词检索、局部读取 | 工具 | ContextBundle |
| 计划 | 生成修改计划和验证计划 | `plan` / `generate` | Plan |
| 文件 | 读取、创建、编辑、删除、补丁 | 工具 | PatchSet |
| Git | status、diff、branch、worktree | 工具 | GitSnapshot |
| 命令 | 运行测试、Lint、构建和用户指定命令 | 工具 | CommandResult |
| 审批 | 写入和高风险命令审批 | CLI | ApprovalDecision |
| 记录 | 事件、命令、diff、验证结果 | `.repo-agent/runs` | RunLog |
| 生成 | 实现小型功能 | `generate` | 可审查变更 |
| 审查 | 只读检查 diff | `review` | Finding[] |
| 修复 | 针对失败测试修改代码 | `fix` | FixReport |

## P1：工程化能力

| 分类 | 功能 |
| --- | --- |
| 测试 | `test` 模式、测试生成、失败分类、有限自动修复 |
| 脚手架 | 模板目录、变量校验、安装后检查、模板版本 |
| 规则 | 仓库规则文件、目录级规则、规则冲突报告 |
| 评估 | 固定仓库任务集、轨迹回放、结果对比 |
| CI | JSONL 输入输出、无头运行、失败状态码、PR 评论草稿 |
| 模型 | 多 Provider、OpenAI-compatible、模型能力声明和预算 |
| 体验 | 彩色 CLI、实时事件、进度、命令重放和差异预览 |

## P2：扩展能力

| 分类 | 功能 |
| --- | --- |
| Web | 本地运行控制台、历史、diff、日志和回滚 |
| IDE | VS Code 扩展，通过稳定 API 连接 Agent Core |
| 协议 | MCP 工具扩展、ACP Agent 接入 |
| 执行 | Docker/远程沙盒、并行任务、资源配额 |
| 团队 | GitHub/GitLab 集成、组织规则、审查队列 |
| 自动化 | 定时依赖升级、定时测试、自动生成维护报告 |

## 命令草案

```text
repo-agent init
repo-agent plan "..."
repo-agent generate "..."
repo-agent review [--base origin/main] [--staged]
repo-agent fix --test "..."
repo-agent test [--changed] [--command "..."]
repo-agent scaffold <template> --name <name>
repo-agent run --json < task.jsonl
repo-agent status <run-id>
repo-agent diff <run-id>
repo-agent undo <run-id> [--checkpoint <id>]
```

## 审批矩阵

| 操作 | 默认策略 |
| --- | --- |
| 读取普通源码 | 自动 |
| 读取规则和配置 | 自动，敏感字段脱敏 |
| 创建或修改文件 | 计划后审批 |
| 运行本地测试/Lint | 自动或一次性授权 |
| 安装依赖 | 单独审批 |
| 删除文件 | 每次审批 |
| 网络访问 | 默认关闭，按命令审批 |
| Git commit | 可选审批 |
| Git push/部署/发布 | 禁止默认自动执行 |
