# 轻量 Coding Agent 方案子工作区

本目录把“参照 Blade Agent，开发一个覆盖代码生成、代码审查、Bug 修复、自动化测试和项目脚手架生成的轻量 Coding Agent”这项调研落成可执行的产品与技术方案。

当前阶段是**方案冻结前的需求基线**，不包含实现代码，不改变现有 Blade Agent 的运行链路。

## 文档导航

- [需求文档](requirements.md)：产品目标、用户、范围、验收标准和非目标。
- [功能清单](feature-list.md)：按优先级拆分的功能、命令和验收状态。
- [架构设计](architecture.md)：分层、模块边界、执行环境和技术选型。
- [逻辑流程](workflows.md)：通用任务、生成、审查、修复、测试、脚手架流程。
- [数据模型](data-model.md)：任务、运行、事件、变更、检查结果和审批记录。
- [路线图与评估](roadmap-and-evaluation.md)：MVP 阶段、测试集和质量指标。
- [参考与借鉴边界](references.md)：开源项目来源、可借鉴内容、禁止复制内容和许可证检查。
- [开源发布准备](open-source-readiness.md)：来源台账、依赖审计、许可证、NOTICE、SBOM 和发布门禁。
- [前端落地包](frontend/README.md)：前端调研、信息架构、设计系统、组件、状态、流程和验收。

## 图表

- [系统上下文](diagrams/system-context.mmd)
- [任务生命周期](diagrams/task-lifecycle.mmd)
- [模式路由](diagrams/mode-flow.mmd)
- [审查与修复闭环](diagrams/review-fix-loop.mmd)
- [MVP 边界](diagrams/mvp-boundary.mmd)

## 方案结论

第一版采用“本地优先、仓库优先、diff 优先、测试闭环”的定位：

```text
CLI + Git worktree + 单进程 Agent Runtime + 受控工具 + JSONL 运行记录
```

先解决一次任务是否能可靠完成、是否可复盘、是否能撤销，再增加 Web 控制台、IDE 集成、远程沙盒和自动化调度。
