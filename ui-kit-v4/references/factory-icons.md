# 工厂图标映射（Factory Icons · lucide-react）

> 本文件把 v4 工厂里每个工段、角色、护栏、锚点、面板该用哪个 lucide 图标**逐个钉死**，
> Codex 照表选用，不自由发挥。统一规则沿用 `iconography.md`：只用 lucide、线性 strokeWidth=2、
> 继承 currentColor、不写死颜色、纯图标按钮带 aria-label。

## 0. 使用约定

- 图标名均为 `lucide-react` 真实导出；新增前先在 `iconography.md` 第 6 节"现有导入清单"里找，
  已导入的直接复用，未导入的再 `import`，**不重复 import**。
- 标记：`[已导入]` = App.tsx 现有清单里有；`[新增]` = 需补充导入。
- 尺寸：工段/角色导航默认 16–17px；空态/面板主图标 20–22px；小标记 11–15px。

## 1. 九工段图标（Stage 0–9，用于 `.stage-dot` 与工段标题）

| Stage | 名称 | lucide 图标 | 状态 |
| --- | --- | --- | --- |
| 0 | 接入基线 | `PlugZap` | [新增] |
| 1 | GreenBuild 环境救活 | `HeartPulse` | [新增] |
| 2 | 业务考古 Legacy Archaeologist | `Search` | [已导入] |
| 3 | 二进制对拍 Decompile & Diff | `Binary` | [新增] |
| 4 | Meta-Skill Builder | `Puzzle` | [新增] |
| 5 | 需求澄清 / 原型 / 契约 | `MessagesSquare` | [新增] |
| 6 | 多角色制造 SwarmFlow | `Users` | [新增] |
| 7 | Rails 护栏 | `ShieldCheck` | [已导入] |
| 8 | 双擎质检 | `Swords` | [新增] |
| 9 | RSI 交付生态 | `Rocket` | [新增] |

工段状态点（done/active/blocked/failed）的形状仍用 `.stage-dot` 容器；
done 用 `Check`[已导入]，blocked 用 `TriangleAlert`[已导入]，active 用 `LoaderCircle`[已导入] + `.spin`。

## 2. 十二角色图标（用于 `.role-avatar` 旁或卡片头）

| 角色 | 缩写 | lucide 图标 | 状态 |
| --- | --- | --- | --- |
| Chief Architect | CA | `Compass` | [新增] |
| Contract Builder | CB | `FileSignature` | [新增] |
| Database Builder | DB | `Database` | [新增] |
| Backend Builder | BE | `Server` | [新增] |
| Frontend Builder | FE | `MonitorSmartphone` | [新增] |
| Seed Data Builder | SD | `Sprout` | [新增] |
| Skill Integrator | SI | `Puzzle` | [新增]（与 Stage 4 复用） |
| Judge | JG | `Scale` | [新增] |
| Red Agent | RED | `Sword` | [新增]（与 Stage 8 复用） |
| Blue Agent | BLUE | `ShieldPlus` | [新增] |
| Visual Agent | VA | `Eye` | [新增] |
| Archiver | AR | `Archive` | [新增] |

## 3. 七护栏图标（用于 `.rail-violation .rv-name` 前）

| 护栏 | lucide 图标 | 状态 |
| --- | --- | --- |
| ForbiddenMemoryRail | `BrainCircuit` | [新增] |
| ContextRedactionRail | `EyeOff` | [新增] |
| PermissionInterruptRail | `Hand` | [新增] |
| ContractVerifyRail | `BadgeCheck` | [新增] |
| CodingMemoryRail | `BookCode` | [新增] |
| BudgetRail | `Wallet` | [新增] |
| AuditRail | `ScrollText` | [新增] |

## 4. 七业务锚点图标（用于 `.biz-nav` / 锚点卡片头）

| data-panshi-id | lucide 图标 | 状态 |
| --- | --- | --- |
| procurement.table | `Table` | [新增] |
| procurement.create | `FilePlus2` | [已导入] |
| procurement.invoice_verify | `ReceiptText` | [新增] |
| procurement.submit | `Send` | [新增] |
| approval.timeline | `GitCommitHorizontal` | [新增] |
| inventory.summary | `Boxes` | [新增] |
| budget.dashboard | `Gauge` | [新增] |

## 5. 面板与细粒度组件图标

| 组件 / 场景 | lucide 图标 | 状态 |
| --- | --- | --- |
| 契约锁定 | `LockKeyhole` | [已导入] |
| 哈希行 | `Fingerprint` | [新增] |
| 红军面板头 | `Sword` | [新增] |
| 裁判面板头 | `Scale` | [新增] |
| 蓝军面板头 | `ShieldPlus` | [新增] |
| 巡航截图 | `Camera` | [新增] |
| 自愈链 | `Workflow` | [新增] |
| 证据链 | `Link2` / `Paperclip` | [新增] |
| 交付报告 | `PackageCheck` | [新增] |
| SkillPack 卡片 | `Blocks` | [新增] |
| PR 草稿 | `GitPullRequest` | [新增] |
| 代码块复制 | `Copy` | [已导入] |
| 日志查看器 | `TerminalSquare` | [已导入] |
| 通知中心 | `Bell` | [新增] |
| 抽屉关闭 | `X` | [已导入] |
| 树展开 | `ChevronRight` | [已导入] |
| 分页上一页/下一页 | `ChevronLeft` / `ChevronRight` | [新增] / [已导入] |
| 下拉选择 | `ChevronDown` | [已导入] |
| 空态主图标 | `Inbox` | [新增] |
| 重试 | `RefreshCw` | [已导入] |
| 主题切换 | `Sun` / `Moon` | [已导入] |

## 6. 新增导入汇总（一次性补，避免零散）

```text
Archive, BadgeCheck, Bell, Binary, Blocks, BookCode, Boxes, BrainCircuit,
Camera, ChevronLeft, Compass, Database, Eye, EyeOff, FileSignature,
Fingerprint, Gauge, GitCommitHorizontal, GitPullRequest, Hand, HeartPulse,
Inbox, MessagesSquare, MonitorSmartphone, PackageCheck, PlugZap, Puzzle,
ReceiptText, Rocket, Scale, ScrollText, Send, Server, ShieldPlus, Sprout,
Sword, Table, Users, Wallet, Workflow
```

## 7. 红线

- 不用 Emoji 当功能图标（测试 HTML 里的占位字符不算产品实现）。
- 不引入第二套图标库、不自造 SVG 与 lucide 并列。
- 图标不承载唯一信息：阻断/状态同时有文案与形状，色盲可辨。
- 同一语义全项目固定一个图标（批准=Check、关闭=X、复制=Copy、重试=RefreshCw）。
