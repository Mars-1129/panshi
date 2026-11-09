# legacy-procurement · 旧物资采购与固定资产管理系统（样例靶场）

这是一个**故意保留缺陷**的旧项目，用来人工核查 PanShi-SwarmFactory 的十工段链路。

## 场景

省属国企的《物资采购与固定资产管理系统》需要信创改造。系统 2015 年上线，原开发商已注销：

- 审批规则散落在 `src/approval.mjs`（50 万以上应急直达副总、20 万以上处长、普通经理）；
- 固定资产折旧在 `src/depreciation.mjs`，**业务要求双倍余额递减法，代码却是直线法**；
- `test/depreciation.test.mjs` 会失败，`test/approval.test.mjs` 通过；
- 旧报表 SQL 在 `src/ledger.mjs`。

## 预期结果（人工核查用）

| 工段 | 预期 |
| --- | --- |
| 00 接入基线 | 资产清单 + 哈希、基线 revision、敏感信息扫描 0 命中、环境摘要 npm/JS |
| 01 环境救活 | `npm run test` 退出码 1，分类 `test`（不是环境/依赖问题），`runnable=true` |
| 02 业务考古 | 从 `approval.mjs` 抽出 3 条阈值规则（5000 万 / 2000 万 / >0），从 `ledger.mjs` 抽出 2 条 SQL 规则，全部带文件与行号 |
| 03 二进制对拍 | **通过**：`lib/libdepreciation.wasm` 是被重写的黑盒（折旧核心算法，源码已丢失）；`src/depreciation-core.mjs` 是重写版，1000 组差分对拍全部一致 |
| 04 技能封装 | 本地 MCP `verify_invoice` → SKILL.md + wrapper，Harness 3/3 |
| 05 需求/契约 | 三份契约校验通过并锁定；生成可点击原型；留下「人工审批」记录（哈希在页面可见） |
| 06 多角色制造 | 数据库/后端/前端三个角色并发产出并合并 |
| 07 护栏 | 裁判读取实现源码被拦截；生成代码路由与 RBAC 校验通过；头部显示「7 道关卡 · 检查 20 项」 |
| 08 双擎质检 | 50 并发复现库存超卖（-40），修复后 0；权限静态检查 5/5；Playwright 巡航 blocked |
| 09 RSI 交付 | 交付报告 + 证据链 + 进化技能包 + PR 草稿 + 来源与许可证台账 |

## 黑盒与重写（工段 03）

旧系统有两层折旧代码：

- `src/depreciation.mjs` —— **业务层**，写的是直线法，与业务要求的双倍余额递减法不符（工段 01 会测出失败）；
- `lib/libdepreciation.wasm` —— **核心算法库**，原为 C 动态库 `.so`，开发商解散后源码丢失，只剩二进制形态。

工段 03 处理后者：`blackbox.json` 声明黑盒与它的重写版，工段 03 会用同一组输入
分别调用原库与新实现，逐值比对。`src/depreciation-core.mjs` 是通过对拍验证的重写成果。

> 把 `blackbox.json` 删掉或清空 `targets`，工段 03 就会变成「不适用」并从进度分母中排除——
> 这演示了两种诚实态的区别：**不适用不是失败，也不是通过**。

## 怎么跑

```bash
cd "new/apps/code-agent"
REPOPILOT_PROVIDER=fake REPOPILOT_REPO="../../samples/legacy-procurement" node server/main.ts --port=4186
```

或在仓库根目录 `pnpm dev`（默认已指向本样例），打开 http://127.0.0.1:4173 ：

1. 点右上角「新建工厂运行」，任务名写「验收：国企采购系统信创改造」；
2. 点「运行 MVP 全链路」，二次确认；
3. 依次点左侧十个工段，核对上表；
4. 工段 09「查看交付报告」，确认阻断项只有 03 与巡航。

## 注意

- 本目录是一个独立 Git 仓库（`git log` 有一条初始化提交），PanShi 的运行记录写在
  `.repo-agent/runs/` 下，已被 `.git/info/exclude` 排除，不会污染 `git status`。
- 样例的失败测试是**故意保留**的，用于验证「测试失败不等于任务成功」。

## 本次实测（2026-11-07）

| 指标 | 结果 |
| --- | --- |
| 工段状态 | `0-2 ✅ / 3 ⛔ / 4-9 ✅`（9 通过、1 阻断） |
| 业务规则 | 13 条（含 `approval.mjs:6/9/12` 的 5000 万 / 2000 万 / >0 阈值） |
| 代码切片 | 6 个函数 |
| 构建诊断 | `npm run test` 退出码 1，分类 `test`（不是环境问题），`runnable=true` |
| 契约 | v1，哈希 `4392aa58b5a9…`，三份校验通过并锁定 |
| 产物 | 30 份 |
| 事件 | 91 条 |
| 红蓝对抗 | 修复前 stock=-40（50 次成功）→ 修复后 stock=0（10 次成功） |
| 浏览器巡航 | blocked（Playwright 未安装） |
