# 轻量 Coding Agent 总体设计

本文件是本方案的总览入口，详细约束拆分在同目录文档中。

## 设计基线

目标是做一个本地优先的 Coding Agent，覆盖代码生成、代码审查、Bug 修复、自动化测试和项目脚手架生成。第一版采用单进程运行时和 Git worktree 隔离，不复制当前 Blade Agent 的分布式 Server/Runner 拓扑。

```text
用户任务
  → 仓库规则与上下文
  → Plan
  → 审批
  → Act
  → 测试/Lint/Build
  → Diff + 证据 + 风险
```

## 约束

- Agent 负责判断，工具负责确定性执行。
- 写入前必须有计划和审批。
- 每次写入必须生成 checkpoint 和可查看 diff。
- 测试失败不等于任务失败原因，必须区分环境、依赖、测试和实现问题。
- 只读审查模式不能修改工作区。
- 默认不推送、不部署、不合并、不读取密钥。

## 文档关系

- 产品需求与验收：[`requirements.md`](requirements.md)
- 功能拆分：[`feature-list.md`](feature-list.md)
- 分层和模块边界：[`architecture.md`](architecture.md)
- 运行逻辑：[`workflows.md`](workflows.md)
- 状态和事件：[`data-model.md`](data-model.md)
- 实施与评估：[`roadmap-and-evaluation.md`](roadmap-and-evaluation.md)
- 开源参考和 clean-room 规则：[`references.md`](references.md)
- 开源发布门禁：[`open-source-readiness.md`](open-source-readiness.md)
- 前端实现设计：[`frontend/README.md`](frontend/README.md)

## 当前结论

如果开始实现，建议先创建 `apps/code-agent/`，只依赖公开协议和新建的 Agent Core，不导入 BA 的内部 Python/Go 模块。第一阶段的交付物应该是一个能在固定测试仓库上完成并解释任务的 CLI，而不是完整 Web 平台。

开源发布必须从第一天建立来源台账和许可证门禁。当前目录只是方案文档，不能被当作已经完成许可证隔离的独立产品；真正落地时应让 `apps/code-agent/` 拥有清晰的代码边界、依赖清单和发布许可证。
