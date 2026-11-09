# 磐石智造 · PanShi-SwarmFactory

面向政企管理系统的多智能体软件工厂：**接手跑不起来的旧系统，交付一套带证据的新系统。**

它不是「AI 帮你写代码」，而是把一次系统改造拆成十个可验证的工段，每一段的结论都由程序判定，
没有执行过的检查不会显示为通过。

- 实现状态与已知边界：[`docs/STATUS.md`](docs/STATUS.md)
- 测试与验证方法：[`docs/TESTING.md`](docs/TESTING.md)

---

## 核心主张

通用 AI 编程交付的是**代码**；这里交付的是**一个能被审计、能被签字、能被追责的工程结论**。

支撑这句话的三件事：

1. **契约即真相** —— 需求先固化成机器可校验的三份契约（`schema.sql` / `openapi.yaml` /
   `component_tree.json`），代码只是契约的实现。契约带 SHA-256，改动就对不上。
2. **护栏即门禁** —— 写入前用静态分析拦截违约代码，不做事后检查。
3. **攻防即验收** —— 独立裁判被物理屏蔽源码读取权限，红军攻击、蓝军修复、复测通过才算数。

所有角色的动作写入**同一条事件日志**（JSONL，单调 seq，可回放），界面上每一个数字都来自它。

---

## 五阶段 · 十工段

| 阶段 | 工段 | 做什么 | 准出条件 |
| --- | --- | --- | --- |
| **S1 接入与解构** | 00 接入基线 | 资产清单、基线 revision、敏感信息扫描 | 清单与哈希落盘 |
| | 01 环境救活 | 隔离副本中真实执行构建，分类失败原因 | 记录真实退出码与分类 |
| | 02 业务考古 | AST 切片，抽取业务规则 | 每条规则带源文件与行号 |
| | 03 二进制对拍 | 黑盒重写后的等价验证 | 1000 组差分对拍 0 不一致 |
| **S2 原型与契约** | 04 技能封装 | MCP 工具自省 → SkillPack + 验毒 | Harness 用例全通过 |
| | 05 需求 / 契约 | 对话出原型，锁三份契约 | 契约校验通过 + 哈希锁定 |
| **S3 并发制造** | 06 多角色制造 | 数据库 / 后端 / 前端 / 技能并行 | 产物合并，预算内完成 |
| **S4 红蓝质检** | 07 护栏 | 写入期 AST 门禁 + 审计留痕 | 违规不落盘 |
| | 08 双擎质检 | 50 并发竞态攻防 + 浏览器巡航 | 不变量全部成立 |
| **S5 交付沉淀** | 09 RSI 交付 | 交付报告、来源台账、经验沉淀 | 证据链完整，未验证项如实列出 |

**不适用 ≠ 失败。** 仓库里没有黑盒时，工段 03 标记为 `not_applicable`，从进度分母中排除，
既不冒充通过，也不当成阻断。

---

## 快速开始

需要 Node 24+、Git、ripgrep。

```bash
# 1. 安装依赖
pnpm --dir apps/code-agent install

# 2. 浏览器界面（默认指向 samples/legacy-procurement 样例靶场）
pnpm dev                    # http://127.0.0.1:4173

# 3. 生产构建
pnpm build
REPOPILOT_REPO=samples/legacy-procurement pnpm server   # http://127.0.0.1:4174
```

没配模型密钥时任务会被标记为 `blocked`，永远不会显示成功；也可以用 `REPOPILOT_PROVIDER=fake`
走离线确定性回退。

### 配置（全部走环境变量，密钥不落盘）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `REPOPILOT_PROVIDER` | `siliconflow` | `siliconflow` / `openai` / `fake` |
| `REPOPILOT_BASE_URL` | `https://api.siliconflow.cn/v1` | OpenAI-compatible 端点 |
| `REPOPILOT_MODEL` | `deepseek-ai/DeepSeek-V4-Flash` | 模型 ID |
| `REPOPILOT_API_KEY` | — | 也接受 `SILICONFLOW_API_KEY` / `OPENAI_API_KEY` |
| `REPOPILOT_REPO` | `samples/legacy-procurement` | 目标仓库（必须是 Git 仓库） |
| `REPOPILOT_PORT` | `4174` | 独立服务端口 |

---

## 样例靶场

`samples/legacy-procurement` 是一个**故意保留缺陷**的旧项目，用来人工核查十工段链路：

- 审批规则散落在 `src/approval.mjs`（50 万以上应急直达副总、20 万以上处长、普通经理）；
- 折旧在 `src/depreciation.mjs` 用了直线法，业务要求是双倍余额递减法；
- `lib/libdepreciation.wasm` 是**源码已丢失的黑盒**（原为 C 动态库），
  `src/depreciation-core.mjs` 是经 1000 组差分对拍验证的重写版；
- 逐工段的预期结果见 [`samples/legacy-procurement/README.md`](samples/legacy-procurement/README.md)。

---

## 测试

```bash
pnpm --dir apps/code-agent test         # 151 个单元与集成用例，全程离线
pnpm --dir apps/code-agent typecheck
pnpm --dir apps/code-agent build
```

新增测试必须可重复、默认离线、适合 `loadfile` 并行：不依赖执行顺序、不共享进程内全局状态、
文件和数据库放 `tmp_path`。单元测试禁止用长 `sleep` 等状态变化。

---

## 目录

```
apps/code-agent/
  src/            React 前端（十工段工作台）
  server/         Node 运行时（十工段执行、事件日志、HTTP/SSE）
  shared/         前后端共享的事件与数据契约
  tests/          151 个单元与集成用例
  cli/            命令行入口
samples/          两个样例靶场
ui-kit-v4/        设计系统（前端静态依赖）
docs/             实现状态与测试说明
```

---

## 边界

- **工段 03 的原生二进制分支**需要 Ghidra，本机未接入；wasm 黑盒路径已跑通。
- **工段 08 的浏览器巡航**需要 Playwright，当前只完成接口级红蓝对抗，UI 巡航标为 blocked。
- **多模型混编、Docker 沙箱池、SkillHub 真实上架**未实现，界面上不提供假入口。
- 发布前仍需对依赖与发布许可证单独审计。

---

## 许可

[MIT](LICENSE)
