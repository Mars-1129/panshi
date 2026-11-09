# PanShi-SwarmFactory · 工厂组件合同（v4）

> 适用范围：`css/components-v4.css`。本文是 v4 工厂类名的**唯一权威**，与 v1–v3 组件合同并列、不冲突。
> 所有类名只消费 `var(--rp-*)`，禁止裸 hex、禁止自定义阴影/圆角。
> 凡业务系统内的交互组件，在 React 中必须同时带 `data-panshi-id`（锚点纪律见 `panshi-anchor-discipline.md`）。

---

## 1. 工厂外壳

| 类名 | 用途 | 备注 |
|---|---|---|
| `.factory-shell` | 工厂主容器，grid 两行（顶栏+主体），占满视口 | 用 `100dvh` |
| `.factory-topbar` | 玻璃顶栏 | 含品牌/元数据/操作 |
| `.factory-brand` `.brand-mark` | 品牌区与方形图标 | |
| `.factory-meta` | projectId / runId 等元数据 | 等宽字体，窄屏隐藏 |
| `.factory-actions` | 顶栏右侧操作区（主题/连接/菜单） | `margin-left:auto` |
| `.factory-body` | 主体 grid：工段导航 + 主区 | 两列 |

---

## 2. 工段导航（Stage 0–9）

| 类名 | 用途 |
|---|---|
| `.stage-rail` | 左侧垂直工段导航，可滚动 |
| `.rail-title` | 导航标题 |
| `.stage-item` | 单个工段按钮（可点） |
| `.stage-dot` | 工段圆点（含序号/图标） |
| `.stage-copy` `.stage-name` `.stage-sub` | 工段名与英文/简述 |
| `.stage-progress` `.progress-track` `.progress-fill` `.progress-label` | 整体工厂进度 |

**状态后缀（加在 `.stage-item` 上）**

| 后缀 | 含义 | 圆点表现 |
|---|---|---|
| `.stage-done` | 已完成、退出条件满足 | 实心绿 |
| `.stage-active` | 正在执行 | 蓝边 + 旋转图标 |
| `.stage-failed` | 失败 | 红 |
| `.stage-blocked` | 阻断/等待外部或人工 | 黄 |
| `.is-selected` | 当前选中 | 主色浅底 |

> 工段顺序固定为 Stage 0–9，不允许前端自行重排；状态来自事件，不允许前端推断。

---

## 3. 工段视图

| 类名 | 用途 |
|---|---|
| `.stage-view` `.stage-container` | 主区滚动容器与最大宽度 |
| `.stage-header` `.stage-title` `.stage-badge` | 工段标题与状态徽章 |
| `.stage-exit` | 退出条件块（强约束可见） |
| `.stage-io` | 输入/输出两列 |
| `.io-col` `.io-head` `.io-list` | 产物列 |
| `.io-item` `.io-name` `.io-hash` `.io-state` | 产物项（名/哈希/状态） |

徽章修饰：`.badge-ok` / `.badge-warn` / `.badge-danger`。

---

## 4. 多角色协作

| 类名 | 用途 |
|---|---|
| `.role-grid` | 角色卡自适应网格 |
| `.role-card` | 单角色卡 |
| `.role-head` `.role-avatar` `.role-name` `.role-status` | 角色头部 |
| `.role-budget` `.budget-track` `.budget-fill` `.budget-text` | 角色预算 |
| `.role-meta` | 工作区/重试等元数据 |
| `.role-concurrency` | 并发指示（真实并发证据） |

**状态后缀（加在 `.role-card`）**：`.role-running` / `.role-done` / `.role-failed` / `.role-blocked`。

---

## 5. 业务系统原型（7 个组件锚点）

> 这是**可交互原型**的核心。每个交互组件必须带 `data-panshi-id`，值取自 `component_tree.json`。

| 类名 | 对应 data-panshi-id | 用途 |
|---|---|---|
| `.biz-shell` | — | 业务系统外壳（模拟管理系统） |
| `.biz-topbar` | — | 业务顶栏 |
| `.biz-body` `.biz-nav` `.nav-item` | — | 业务菜单与布局 |
| `.biz-page` `.biz-page-head` | — | 业务页面容器 |
| `.procurement-table` | `procurement.table` | 采购单表格 |
| `.procurement-form` `.field` `.field-label` `.field-input` | `procurement.create` | 新建采购单 |
| `.invoice-verify` `.verify-button` `.verify-result` | `procurement.invoice_verify` | 发票核验（绑定转换后的 Skill） |
| `.procurement-submit` | `procurement.submit` | 提交审批 |
| `.approval-timeline` `.tl-item` `.tl-dot` `.tl-copy` | `approval.timeline` | 审批时间线 |
| `.inventory-summary` `.inv-metric` | `inventory.summary` | 库存汇总 |
| `.budget-dashboard` `.budget-card` `.budget-bar` `.budget-row` | `budget.dashboard` | 预算看板 |

表格行状态：`.state-approved` / `.state-pending` / `.state-rejected`。
库存/预算告警：`.inv-metric.is-low`、`.budget-bar.is-over`。
开发态锚点：`.anchor-flag`（显示锚点名），`.biz-shell[data-anchors="dev"]` 下悬停高亮。

---

## 6. 契约审查与锁定

| 类名 | 用途 |
|---|---|
| `.contract-review` | 契约审查容器（三契约） |
| `.contract-tabs` `.ct-tab` | schema.sql / openapi.yaml / component_tree.json 切换 |
| `.contract-panel` | 契约内容（等宽、可滚动） |
| `.contract-meta` `.hash-line` | 哈希与元数据 |
| `.contract-lock` | 锁定按钮 |
| `.contract-version` | 版本号 |
| `.lock-banner` | 已锁定提示 |
| `.is-locked`（加在 `.contract-review`） | 锁定态描边 |

---

## 7. 护栏阻断

| 类名 | 用途 |
|---|---|
| `.rail-list` | 阻断事件列表 |
| `.rail-violation` | 单条阻断（左侧红条） |
| `.rv-head` `.rv-name` `.rv-sev` | 护栏名与严重度 |
| `.rv-body`（`dt/dd`） | expected/actual 等证据字段 |
| `.rv-recovery` | 恢复建议 |

---

## 8. 红蓝攻防

| 类名 | 用途 |
|---|---|
| `.adversarial-board` | 三列：红军/裁判/蓝军 |
| `.attack-panel` `.judge-panel` `.repair-panel` | 三阵营面板 |
| `.panel-head` `.panel-body` | 面板头/体 |
| `.finding-card` `.fc-sev` `.fc-title` | 漏洞/发现卡 |
| `.attack-barrage` `.barrage-dots` | 并发攻击指示 |

严重度：`.sev-critical` / `.sev-high` / `.sev-medium`；已修复：`.finding-card.is-resolved`。

---

## 9. 浏览器巡航与自愈

| 类名 | 用途 |
|---|---|
| `.cruise-view` | 巡航两列 |
| `.cruise-steps` `.cruise-step` | 关键路径步骤 |
| `.cruise-screenshot` | 页面截图 |
| `.cruise-errors` `.cruise-error` | 错误类型 |
| `.self-heal` `.heal-chain` `.heal-node` `.heal-arrow` | 自愈链（锚点→源文件→修复→重跑） |

步骤状态：`.is-done` / `.is-running` / `.is-failed`。

---

## 10. 证据链与交付报告

| 类名 | 用途 |
|---|---|
| `.evidence-chain` `.ev-item` `.ev-seq` `.ev-type` `.ev-ref` | 统一证据时间线 |
| `.delivery-report` | 交付报告 |
| `.report-section` | 报告分节 |
| `.report-stats` `.report-stat` `.rs-value` `.rs-label` | 统计数字 |
| `.report-verify` | 未验证项诚实标记 |

---

## 11. RSI / 生态输出

| 类名 | 用途 |
|---|---|
| `.skillpack-card` `.sp-head` `.sp-name` `.sp-meta` | 进化 SkillPack 卡 |
| `.pr-draft` `.pr-head` `.pr-state` `.pr-body` `.pr-note` | 自动 PR 草稿（不自动发布） |

---

## 12. 命名与状态纪律（硬约束）

1. 类名全部小写、连字符；状态用 `.is-*` 或 `*-<state>` 后缀，不新造状态词。
2. 颜色不只靠颜色：状态同时有图标/文字/形状（见 `accessibility.md`）。
3. 工段/角色/阻断的状态必须来自事件与证据，前端不得把未执行/阻断显示成通过。
4. 窄屏（1024/640）与 `prefers-reduced-motion` 已在组件内处理，新增组件须同步补响应式与减弱动效。
