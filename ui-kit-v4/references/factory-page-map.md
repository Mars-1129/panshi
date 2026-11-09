# 工厂信息架构与页面地图（Factory Page Map）

> 本文件定义 v4 工厂前端的**视图层级、视图枚举、面包屑、跳转关系与窄屏行为**。
> 路由与字段来自 OpenAPI（见前端纪律），这里只定义"前端有哪些视图、怎么组织、怎么跳"，
> 不硬编码业务接口地址。与现有 `NavView`（workspace/templates/settings）并存，不冲突。

## 1. 顶层信息架构

```text
PanShi-SwarmFactory
├─ 工厂驾驶舱（Factory Cockpit）
│   ├─ 工段导航 Stage 0–9（左 rail）
│   └─ 工段工作区（随选中工段切换）
│        ├─ 工段视图（退出条件/输入输出/角色）
│        ├─ 契约视图
│        ├─ 护栏视图
│        ├─ 攻防视图
│        ├─ 巡航视图
│        ├─ 证据交付视图
│        └─ RSI 视图
├─ 业务系统原型（Biz Prototype，7 锚点外壳）
│   └─ 采购/审批/库存/预算 7 个锚点页面
└─ 全局
    ├─ 命令面板（Command Palette）
    ├─ 通知中心（Notification Center）
    └─ 抽屉（Drawer，窄屏详情/活动）
```

## 2. 前端视图枚举（视图层路由 key，非后端 URL）

```ts
export type FactoryViewKey =
  // 驾驶舱
  | "cockpit"
  | "stage"            // 配合 stageId 0..9
  | "contract"
  | "rails"
  | "adversarial"
  | "cruise"
  | "delivery"
  | "rsi"
  // 业务原型
  | "biz"              // 配合 anchorId
  // 全局浮层
  | "command"
  | "notifications";
```

- 视图 key 是前端枚举；真实数据请求路径仍从 OpenAPI 取，不把 key 当接口路径。
- 未实现的视图给诚实空态（如模板库），不放假入口。

## 3. 视图层级与面包屑

| 视图 | 面包屑（`.breadcrumb`，等宽显示 id） |
| --- | --- |
| 驾驶舱 | `工厂 / 驾驶舱` |
| 工段 | `工厂 / 工段 / Stage {n} · {name}` |
| 契约 | `工厂 / 契约 / {kind}` |
| 护栏 | `工厂 / 护栏 / {railName}` |
| 攻防 | `工厂 / 质检 / 红蓝攻防` |
| 巡航 | `工厂 / 质检 / 浏览器巡航` |
| 证据交付 | `工厂 / 交付 / runId` |
| RSI | `工厂 / 生态 / SkillPack` |
| 业务锚点 | `业务原型 / {anchorId}` |

- 面包屑每一级可点回上一层；当前页最后一级不可点。
- id/哈希用等宽字体，不展示敏感全文。

## 4. 视图跳转关系

```text
工段导航点击 stage-item
   └─> cockpit/stage?stageId=n（rail 保持可见，右侧 stage-view 切换）
stage-view 内点击输出产物
   └─> 抽屉打开产物详情（不离开当前工段）
契约 hash/锁定横幅
   └─> contract 视图（只读，锁定后无编辑入口）
护栏阻断卡
   └─> rails 视图，定位到对应 rail-violation
攻防 finding-card
   └─> 抽屉显示 finding 证据（evidenceRefs）
巡航错误 cruise-error
   └─> 对应 biz 锚点（anchorId 跳转）
证据链 ev-item
   └─> 抽屉/新视图展示证据，不直接下载敏感件
业务原型 nav-item
   └─> biz?anchorId=...（7 锚点切换，带 data-panshi-id）
命令面板（Ctrl/Cmd+K）
   └─> 任意工段/锚点/通知，选中后关闭并跳转
```

- 跳转不刷新整页；视图切换在面板加 `.tab-enter` 轻微入场。
- 写操作（提交/审批/锁定/PR）必须先经审批/RBAC，视图不提供越权入口。

## 5. 工段与视图的对应（哪个工段默认看什么）

| Stage | 主视图 | 关键面板 |
| --- | --- | --- |
| 0 接入基线 | stage | 基线输入产物、连接状态 |
| 1 环境救活 | stage | 环境检查、失败恢复 |
| 2 业务考古 | stage | 考古发现、证据 |
| 3 二进制对拍 | stage | 对拍样本、差异 |
| 4 Meta-Skill | rsi | SkillPack、注册状态 |
| 5 需求/原型/契约 | contract + biz | 契约锁定、原型锚点 |
| 6 多角色制造 | stage | 角色卡、并发、预算 |
| 7 护栏 | rails | 阻断证据 |
| 8 双擎质检 | adversarial + cruise | 攻防、巡航自愈 |
| 9 RSI 交付 | delivery + rsi | 证据链、报告、PR |

## 6. 响应式信息架构（与 responsive-matrix 配套）

| 断点 | 布局变化 |
| --- | --- |
| ≥1200px | 左工段 rail 常驻 + 右工段视图，三列攻防并排 |
| 1024–1199 | rail 收窄，角色卡 2 列，攻防仍三列 |
| 640–1023 | rail 转抽屉（汉堡触发，`.is-rail-open`），攻防/巡航转单列，业务 nav 横向滚动 |
| <640 | 单列，顶栏隐藏 meta，触控目标 ≥44px，抽屉全屏，底部不被 composer 遮挡 |

## 7. 导航红线

- 不新增与工厂视图平行的导航体系；对话（v3）与工厂（v4）通过统一外壳切换，不各做各的。
- 未审批/未锁定/blocked 的视图状态如实呈现，不把不可点击项伪装成可点击。
- 浏览器后退/前进能在工段与锚点间正确回退（视图 key 进历史栈）。
