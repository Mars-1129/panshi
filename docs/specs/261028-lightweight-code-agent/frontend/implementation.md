# 前端完整实现方案

## 1. 实现目标

前端的任务不是“做一个聊天页面”，而是把 Agent 的不确定执行过程变成用户可以审查的工程工作流。

用户必须能快速回答：

- 当前正在处理哪个仓库和哪个任务？
- Agent 计划改什么？
- 哪些操作需要我批准？
- 现在执行到了哪一步？
- 改了哪些文件？
- 哪些测试通过，哪些失败？
- 结果是否可以交付、继续修复或撤销？

## 2. 推荐技术栈

- React 19 + TypeScript strict。
- Vite，先做本地 SPA。
- TanStack Query：服务端任务、事件游标、检查结果和模板数据。
- Zustand 或等价轻量 store：只保存 UI 状态，不保存服务端事实。
- Zod：API 和事件的运行时校验。
- CSS variables + CSS Modules 或局部 CSS：设计 token 单一来源。
- SVG 图标库：统一尺寸和可访问名称，不使用 Emoji 作为功能图标。
- Vitest：组件和 view-model 测试。
- Playwright：真实浏览器、键盘流程和响应式截图。

首版不引入 Monaco、Three.js、复杂图表库或大型设计系统。Diff 可以先采用轻量文本渲染，代码编辑器在确实需要编辑能力时再按路由懒加载。

## 3. 推荐目录

```text
apps/code-agent/
├─ src/
│  ├─ app/
│  │  ├─ router.tsx
│  │  ├─ providers.tsx
│  │  └─ app-shell.tsx
│  ├─ features/
│  │  ├─ workspace/
│  │  ├─ tasks/
│  │  ├─ plan/
│  │  ├─ run/
│  │  ├─ changes/
│  │  ├─ checks/
│  │  ├─ review/
│  │  ├─ templates/
│  │  └─ settings/
│  ├─ components/
│  │  ├─ layout/
│  │  ├─ feedback/
│  │  ├─ controls/
│  │  └─ data-display/
│  ├─ lib/
│  │  ├─ api/
│  │  ├─ events/
│  │  ├─ formatters/
│  │  └─ accessibility/
│  ├─ styles/
│  │  ├─ tokens.css
│  │  ├─ globals.css
│  │  └─ themes.css
│  └─ types/
└─ tests/
   ├─ components/
   ├─ view-models/
   └─ e2e/
```

## 4. 应用壳层

桌面宽度采用三段式工作台：

```text
┌──────────────┬──────────────────────────────┬───────────────────┐
│ Workspace    │ Task work surface            │ Evidence rail     │
│ rail         │ Plan / events / diff / checks│ Approval / result  │
│ 240px        │ minmax(0, 1fr)               │ 340px             │
└──────────────┴──────────────────────────────┴───────────────────┘
```

- 左侧：仓库、任务、模板、设置和最近运行。
- 顶部：当前仓库、worktree、连接状态、任务状态和全局命令入口。
- 中间：当前任务的主工作面，一次只强调一个主要动作。
- 右侧：审批、测试结果、风险和交付摘要；可折叠，不应遮挡主内容。

## 5. 信息架构

### 工作区首页

展示当前仓库、最近任务、未处理审批、失败检查和快速开始入口。

### 新建任务

自然语言输入 + 模式选择 + 目标范围 + 验证要求。提交后先进入计划，不直接写入。

### 任务工作区

任务详情页使用稳定的五个视图：

1. `Overview`：目标、状态、当前阶段和下一步。
2. `Plan`：修改文件、步骤、风险和验证命令。
3. `Run`：实时事件、工具调用、命令输出和暂停/取消。
4. `Changes`：文件树、diff、checkpoint 和回滚入口。
5. `Checks`：测试、Lint、类型检查、构建和失败分类。

代码审查任务额外显示 `Review`，但不改变任务工作区的整体骨架。

### 模板页

按语言/框架筛选脚手架模板，展示模板版本、输入变量、生成文件和验证命令。

## 6. 数据流和状态边界

```text
API/SSE/WebSocket
  → schema validate
  → event reducer
  → task view-model
  → React components
```

- API 事实进入 Query cache 或事件 reducer。
- UI store 只保存面板折叠、选中 tab、命令面板、主题和本地草稿。
- 组件不自行推断任务完成；统一由 `task-view-model.ts` 派生。
- 运行事件使用游标，断线后从最后一个游标恢复。
- 旧事件不会覆盖更新版本的任务状态，使用 `seq` 或服务器版本号保护。

## 7. 核心交互

### Plan/Act

- Plan 卡片显示变更目标、文件列表、风险和验证命令。
- `开始执行` 是唯一主动作。
- 修改计划后必须显示“计划已变化”，重新请求审批。

### 审批

- 审批条说明动作、影响范围和预计命令。
- 高风险动作单独审批，不用一个“全部允许”隐藏差异。
- 拒绝后保留计划和原因，允许改计划或结束任务。

### 运行

- 事件时间线区分模型思考摘要、工具调用、命令输出、检查和人工操作。
- 长输出默认折叠，保留退出码和关键摘要。
- 运行中可暂停、取消或追加指令；按钮不能通过消失来表达完成。

### Diff

- 左侧文件树显示新增、修改、删除和未验证状态。
- 中间显示语法高亮 diff。
- 右侧显示当前文件相关检查和审查发现。
- 每个 checkpoint 提供恢复或比较入口。

### 交付

- 交付报告显示变更摘要、验证命令、通过/失败结果、未解决风险。
- 用户可复制报告、导出 JSON、继续修复、创建 commit 或丢弃 worktree。

## 8. 响应式策略

- `>= 1200px`：三列工作台。
- `768–1199px`：左侧导航折叠，证据栏变成可拉出的 sheet。
- `< 768px`：单列，顶部显示仓库和任务状态；Plan、Run、Changes、Checks 使用 tab。
- `< 480px`：主动作固定在底部安全区，事件详情使用全屏 sheet。
- 代码和 diff 不强制压缩到不可读宽度，允许横向滚动，但页面整体不能横向溢出。

## 9. 前端实现顺序

### Phase 1：壳层和 token

- 路由、主题、AppShell、响应式容器、焦点样式。
- 静态任务 fixture 和所有核心状态样例。

### Phase 2：任务输入和计划

- Workspace 首页。
- 新建任务。
- Plan 卡片、审批条、空/错误/加载态。

### Phase 3：运行与证据

- 事件时间线。
- 命令输出。
- 检查结果。
- 断线恢复和任务取消。

### Phase 4：Changes/Review

- 文件树和 diff。
- Finding 列表。
- checkpoint 和回滚入口。

### Phase 5：模板与质量门禁

- 脚手架模板页。
- Playwright 真实流程。
- 键盘、屏幕阅读器、窄屏和性能验收。

## 10. 前端完成定义

前端只有同时满足以下条件才算可交付：

- 真实任务状态能驱动页面，不依赖假计时器。
- 计划、审批、运行、检查和结果都有可见状态。
- 失败保留输入、原因和恢复路径。
- Diff、命令和检查结果可追溯到事件或 API 响应。
- 桌面、平板、手机的核心路径均可完成。
- 键盘和 reduced-motion 路径完成验证。
