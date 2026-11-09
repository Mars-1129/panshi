# 空态 · 阻断 · 加载 · 重试规范（Empty / Blocked / Loading / Retry）

> 诚实呈现是 v4 的硬纪律。本文件把每类工段在"没数据 / 被阻断 / 出错 / 加载中 / 重试"
> 时的**具体 DOM 结构、类名与文案规则**定下来，Codex 照做，不允许把未执行显示成通过。
> 骨架基础见 `motion.css` 与组件目录 8.8，空态基础类 `.empty-state` 已存在，本文件补工厂口径。

## 1. 五种可用性（对应 factory-view-model 的 ViewAvailability）

| 场景 | 根类名 | 必须回答的问题 |
| --- | --- | --- |
| 加载中 | `.state-loading` + `.skeleton*` | 正在加载什么（文字说明，不能只转圈） |
| 空态 | `.empty-state` | 为什么空 + 下一步动作 |
| 阻断 | `.state-blocked` / `.rail-violation` | 被谁阻断、原因、怎么恢复 |
| 错误 | `.state-panel-error` / `.action-error` | 出了什么错、重试入口 |
| 就绪 | 正常组件 | — |

## 2. 空态 DOM（复用 `.empty-state`，工厂文案）

```html
<div class="empty-state">
  <span aria-hidden="true"><!-- Inbox 图标 20–22px --></span>
  <strong>该工段尚未产出</strong>
  <p>上游工段还未完成，这里会在产物生成后自动出现。</p>
  <div class="empty-actions">
    <button class="button-quiet" type="button">查看上游工段</button>
  </div>
</div>
```

文案规则：
- 禁止只写"暂无数据"。必须说明**为什么空**和**下一步**。
- 空态不放假入口、不放假表格行；按钮只跳真实存在的视图。
- 模板库等未实现页面：标题"该模块尚未实现"，说明属于哪个里程碑，不摆可点击假卡片。

## 3. 阻断 DOM（blocked，护栏/预算/外部不可用）

```html
<div class="state-blocked" role="status">
  <div class="blocked-head">
    <!-- TriangleAlert 图标 -->
    <strong>工段被阻断，未执行</strong>
  </div>
  <p class="blocked-reason">外部依赖不可用：发票核验 MCP 连接失败。</p>
  <div class="blocked-actions">
    <button class="button-secondary" type="button">查看阻断证据</button>
    <button class="button-primary" type="button">重试连接</button>
  </div>
</div>
```

- 阻断态**明确写"未执行"**，绝不显示绿色对勾或"通过"。
- 预算超支：`.role-card` 加阻断态，文案"已超预算，角色暂停"，恢复需审批，不自动继续。
- 护栏阻断用 `.rail-violation`（字段见 factory-components / view-model），证据字段完整。
- 外部不可用输出 `blocked` 与原因，不把未执行显示成通过。

## 4. 错误 DOM（role=alert，可重试）

```html
<div class="state-panel-error" role="alert">
  <strong>工段执行失败</strong>
  <p class="error-message">退出码 1：类型检查未通过（详见日志）。</p>
  <div class="error-actions">
    <button class="button-secondary" type="button">查看日志</button>
    <button class="button-primary" type="button">重试</button>
  </div>
</div>
```

- 错误保留上下文与输入，不静默清空；轻量错误也可用 `.action-error`（可关闭）。
- 重试按钮调用既有恢复流程，重试次数来自 `retryCount`，不无限重试。
- 不用旋转图标作为唯一错误反馈。

## 5. 加载骨架 DOM（结构与真实内容对齐）

```html
<!-- 工段视图骨架 -->
<div class="state-loading" aria-busy="true">
  <div class="skeleton-card">
    <div class="skeleton skeleton-title" style="width:160px"></div>
    <div class="skeleton-line" style="width:90%"></div>
    <div class="skeleton-line" style="width:70%"></div>
  </div>
</div>

<!-- 角色卡骨架 -->
<div class="skeleton-card">
  <div class="skeleton-circle" style="width:34px;height:34px"></div>
  <div class="skeleton-line" style="width:60%"></div>
  <div class="skeleton-line" style="width:90%"></div>
</div>

<!-- 表格骨架：行数与真实分页一致 -->
<div class="skeleton-line" style="width:100%"></div>
<div class="skeleton-line" style="width:100%"></div>
<div class="skeleton-line" style="width:85%"></div>
```

规则：
- 骨架只在**加载中**显示，数据到达即移除；不用骨架伪装已完成或已通过。
- 骨架形状/数量与真实组件对齐（表格出表格骨架、卡片出卡片骨架），不要通用灰条铺满。
- 可量化等待用确定进度条（真实 %）；无法量化才用 indeterminate，且必须配文字。

## 6. 逐工段空态/阻断文案表

| 工段 | 空态文案要点 | 阻断典型原因 |
| --- | --- | --- |
| 0 接入基线 | 尚未采集基线信息 | 仓库/连接不可达 |
| 1 环境救活 | 环境检查未开始 | 依赖安装失败、无权限 |
| 2 业务考古 | 尚未产生考古发现 | 动态库无法读取 |
| 3 二进制对拍 | 尚未生成对拍样本 | Ghidra/样本工具不可用 |
| 4 Meta-Skill | 尚未发现可封装工具 | MCP tools/list 不可用 |
| 5 需求/契约 | 契约尚未生成 | 人工未确认，无法锁定 |
| 6 多角色制造 | 角色尚未开始 | 契约未锁定/预算暂停 |
| 7 护栏 | 暂无阻断记录（正常态） | 任一 Rail 触发 |
| 8 双擎质检 | 尚未发起攻防/巡航 | 前置未通过、浏览器不可用 |
| 9 RSI 交付 | 证据尚未集齐 | 证据校验失败、PR 受阻 |

## 7. 重试与恢复规则

- 瞬时错误（网络抖动）：允许有限自动退避重试，上限明确，超过转人工并显示原因。
- 非瞬时错误（契约不符、权限、预算）：不自动重试，走审批/恢复建议，按钮文案指向具体动作。
- 同一动作失败两次后换通道（命令/依赖/路径），不盲目重复同一请求。
- 恢复计划来自 `recoveryPlan`，视图如实展示 `retryCount`、是否需要人工介入。

## 8. 可访问性

- 错误/阻断用 `role="alert"`/`role="status"`；加载区 `aria-busy="true"`。
- 骨架对屏幕阅读器隐藏，另提供"正在加载…"的可读文本。
- 不依赖颜色区分状态：阻断有图标+文案，错误有明确文字。
- 重试按钮可键盘聚焦，焦点在刷新后落在合理位置，不丢失上下文。
