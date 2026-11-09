# RepoPilot Lite 前端落地包

这组文档把轻量 Coding Agent 的产品设计落成可实现的 React/Vite 前端方案。

前端的核心比喻是**证据工作台**：用户提交任务，看到计划、审批、变更、测试和风险证据；聊天只是输入方式，不是主要信息架构。

## 文档

- [前端调研与借鉴边界](skill-research.md)
- [完整实现方案](implementation.md)
- [设计系统](design-system.md)
- [组件目录](component-catalog.md)
- [页面地图](page-map.md)
- [状态与流程](state-and-flows.md)
- [实现与验收清单](implementation-checklist.md)

## 图表

- [应用壳层](diagrams/app-shell.mmd)
- [任务执行流程](diagrams/task-run-flow.mmd)
- [组件数据流](diagrams/component-data-flow.mmd)
- [响应式布局](diagrams/responsive-layout.mmd)
- [前端状态机](diagrams/frontend-state.mmd)

## 设计结论

第一阶段不做营销首页，也不把所有功能堆成一个聊天窗口。先实现一个可以审查、可回退、可验证的桌面工作台：

```text
工作区导航 → 任务输入 → 计划 → 审批 → 运行事件 → Diff/检查 → 交付报告
```

实现时使用新的 `repopilot-frontend` Skill。它只承载本产品的规则，不继承 OmniDirector 的颜色、品牌、页面语义或组件实现。
