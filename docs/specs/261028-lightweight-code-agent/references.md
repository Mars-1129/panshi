# 参考与借鉴边界

本文档记录调研来源和计划采用的抽象，不记录或复制第三方源码、Prompt、界面文案、测试数据和视觉资产。它是设计来源记录，不是第三方代码授权文件。

## 当前工作区

### Blade Agent

借鉴：

- `core/host/server/runner` 的职责分层思想。
- Context contribution 和工具结果结构化。
- 事件日志、checkpoint、工作区隔离和验证闭环。
- SDK、CLI、Web 共用协议。

不直接借用：

- 业务路由、会话数据库、连接器和产品角色。
- Server/Runner 的分布式运行时实现。
- 现有 Prompt、UI、文案和测试夹具。

参考文件：

- `CLAUDE.md`
- `ba/internal/server/README.md`
- `docs/specs/260929-agent-runtime-split/design.md`
- `web/packages/agent-client/`

## OpenHands

官方 SDK 将 Agent、工具、会话、工作区、事件和 Agent Server 分开，并支持本地工作区或临时工作区，适合参考其可组合边界。[Software Agent SDK](https://github.com/OpenHands/software-agent-sdk)

借鉴：SDK 与执行环境分离、事件和工作区抽象。

避免：复制 SDK 源码、类名、Prompt、Web UI 或完整服务拓扑。

注意：OpenHands 生态包含多个仓库，官方文档提示不同仓库可能有独立许可证，使用前必须逐仓库核对。[OpenHands 生态说明](https://github.com/mvanhorn/openhands-docs/blob/main/overview/introduction.mdx)

## Aider

Aider 的文档展示了仓库地图、终端优先、`ask/code/architect` 模式以及自动处理 Lint/Test 错误的工作方式。[Aider 文档](https://aider.chat/docs/) [模式说明](https://github.com/Aider-AI/aider/blob/main/aider/website/docs/usage/modes.md)

借鉴：仓库摘要、模式切换、架构计划与代码编辑分离。

避免：复制编辑格式实现、Prompt、仓库地图算法和终端输出文案。

## SWE-agent / SWE-ReX

SWE-agent 的架构强调 Agent 与执行环境之间使用清晰的 Agent-Computer Interface；SWE-ReX 将沙盒 shell 会话单独抽象出来。[SWE-agent 架构](https://swe-agent.com/latest/background/architecture/) [SWE-ReX](https://swe-rex.com/latest/)

借鉴：窄工具接口、命令会话、执行后端可替换。

避免：直接把维护中的 SWE-agent 作为产品核心，或复制其 ACI 配置和评估任务。

## Cline

Cline 公开了同一 Agent Core 服务 CLI、IDE、Desktop 和 SDK 的方向，并强调 Plan/Act、审批、checkpoint、规则文件和 MCP 扩展。[Cline 官方站](https://cline.bot/) [Cline CLI](https://github.com/cline/cline/blob/main/apps/cli/README.md)

借鉴：统一核心、审批层、规则文件和无头 CI 模式。

避免：复制 UI 交互、图标、品牌和任务历史结构。

## Goose

Goose 使用 MCP 作为扩展边界，也支持 ACP Server/Provider 互操作；其 Code Mode 通过少量元工具按需发现工具，减少上下文压力。[Goose 架构](https://goose-docs.ai/docs/goose-architecture/) [Goose Code Mode](https://goose.vcorp.ai/docs/guides/managing-tools/code-mode/)

借鉴：MCP/ACP 作为后续协议边界、按需暴露工具。

避免：第一版直接引入复杂扩展生态，避免轻量目标被插件系统拖慢。

## Continue

Continue 的规则文件和源代码管理的 AI Checks 适合作为仓库规则与 CI 审查的参考。[Rules](https://docs.continue.dev/customize/rules) [官方仓库](https://github.com/continuedev/continue)

借鉴：规则版本化、CI 无头审查、IDE 与 CLI 共享行为。

避免：复制配置格式、扩展 UI 和具体指令文案。

## Clean-room 实施规则

1. 只记录公开资料中的行为、协议和架构结论。
2. 新代码由本项目自己的类型、测试和实现产生。
3. 不复制源码、Prompt、UI、图标、测试样例、数据集和命名体系。
4. 复用第三方代码时，先记录仓库、版本、文件、许可证和保留义务。
5. 依赖许可证、NOTICE 和版权声明随发布物检查。
6. 每项借鉴都写入本文件，说明“借鉴了什么”和“实现如何不同”。

## 借鉴分级

| 等级 | 内容 | 默认处理 |
| --- | --- | --- |
| A | 公开产品行为、架构概念、论文和文档中的一般方法 | 可以研究和重新设计，保留来源链接 |
| B | MCP、ACP、HTTP、JSONL 等公开协议 | 按协议实现，遵守协议本身的许可证和商标规则 |
| C | 第三方库作为依赖使用 | 逐项核对许可证、版本、NOTICE 和传递依赖 |
| D | 第三方源代码、Prompt、UI、测试数据或资产 | 默认禁止；除非另立复用决策并完成许可证和归属审查 |

本项目的默认路线只使用 A、B、C。D 类内容不能因为“开源”或“能在 GitHub 找到”就直接复制。

## 来源台账模板

每次采纳外部启发或依赖，都在实现仓库维护一条记录：

```text
source_id:
source_name:
url:
version_or_commit:
license:
observed_behavior_or_api:
our_independent_design:
reused_source_files: none
required_attribution:
reviewer:
review_date:
```

`our_independent_design` 必须描述自己的类型、状态转换、工具接口和测试；不能只写“参考了某项目”。

## 模型生成内容的来源控制

- 不要求模型复现某个项目的源码、Prompt、UI 或专有文案。
- 不把第三方仓库源码整包放入上下文后要求“改写成我们的版本”。
- 评估样例使用自建仓库或明确允许再分发的仓库，避免把第三方测试夹具打包进产品。
- 生成代码在合并前进行许可证/版权片段扫描；发现疑似大段近似内容时进入人工审查。
- 生成结果不能自动被标记为“无第三方来源”；只能记录使用的模型、输入范围和人工审查状态。
