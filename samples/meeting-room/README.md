# meeting-room · 会议室预约系统（新建项目样例）

这是"我要开发一个项目"的最小样例：项目里只有一份需求包和少量初始业务代码，
工厂从 **Stage 5** 开始按需求生成契约、可点击原型、数据库/后端/前端代码，直到交付。

## 输入

```
.panshi/requirement.json   # 产品名、2 个实体、7 个锚点（id / 标签 / 路由 / RBAC / 方法）
src/booking.mjs            # 初始业务规则（审批阈值、时段校验）
test/booking.test.mjs      # 初始测试（全部通过）
```

需求包是唯一的"产品定义"，契约与代码都从它推导；改需求就改这一个文件。

## 怎么跑

```bash
cd new/apps/code-agent
REPOPILOT_REPO="../../samples/meeting-room" pnpm dev       # http://127.0.0.1:4173
# 或指定端口直接起服务：
REPOPILOT_PROVIDER=fake REPOPILOT_REPO="../../samples/meeting-room" node server/main.ts --port=4187
```

1. 页面右上「新建工厂运行」，标题写「会议室预约系统 1.0」；
2. 点「运行 MVP 全链路」并二次确认；
3. 打开工段 05：状态条显示「契约 v1 已锁定 / 原型已生成 / 人工审批 2 条」，
   下方是 7 个锚点的契约原型（预约日历、新建预约、审批预约、会议室列表、使用统计、审批时间线、预约规则）；
4. 工段 06：三个角色并发生成 `db/schema.sql`、`backend/server.mjs`、7 个 Vue 页面；
5. 工段 07：护栏校验生成代码的路由与 RBAC；
6. 工段 08：权限检查 7/7；巡航仍 blocked（Playwright 未安装）；
7. 工段 09：交付报告 + 来源台账。

## 预期结果

| 工段 | 结果 |
| --- | --- |
| 00–04 | 基线/构建/考古/技能：真实执行；03 二进制对拍阻断（新建项目无二进制） |
| 05 | 三份契约由需求包生成并锁定；`prototype.html` 含 7 个锚点 |
| 06 | 生成 `meeting_room`、`booking` 两张表；后端 7 条路由；前端 7 个 Vue 页面 |
| 07 | 生成代码路由全部在契约内，写路由带 RBAC 注解 |
| 08 | 权限检查 7/7 通过；红蓝对抗仍用内置库存靶场（与业务域无关） |
| 09 | 交付报告 `verified=false`（工段 03 阻断），来源台账 4 条 |

## 换一个项目

复制本目录，改 `.panshi/requirement.json` 的 `product`、`entities` 与 `anchors`，
再补一点初始源码与测试即可。最小约束：3–12 个锚点、锚点形如 `domain.action`、
写操作（post/put/patch/delete）必须带 `scope`。
