# 响应式矩阵（Responsive Matrix）

> 本文件把 v4 每个工厂组件在各断点下的**具体表现**逐档钉死，配合 `components-v4.css` 的
> media query 与 `factory-page-map.md` 使用。断点沿用 token：1200 / 860 / 640（v4 另用 1024）。
> 目标：Codex 不用猜"窄了该怎么排"，照表实现并用 headless 多尺寸验证。

## 1. 断点与目标设备

| 断点 | 典型设备 | 容器策略 |
| --- | --- | --- |
| ≥1440 | 大屏桌面 | 内容最大宽度约束，避免超长行 |
| 1200–1439 | 常规桌面 | 标准三区（顶栏/工段 rail/视图） |
| 1024–1199 | 小桌面/横屏平板 | rail 收窄，角色卡 2 列 |
| 640–1023 | 平板 | rail 转抽屉，攻防/巡航单列 |
| 375–639 | 手机 | 单列，抽屉全屏，触控 ≥44 |
| <375 | 窄手机 | 进一步压缩，保留关键信息 |

## 2. 逐组件表现矩阵

| 组件 | ≥1200 | 1024–1199 | 640–1023 | <640 |
| --- | --- | --- | --- | --- |
| `.factory-topbar` | 全 meta 可见 | 同左 | 同左 | 隐藏 `.factory-meta`，保留品牌+动作 |
| `.stage-rail` | 常驻 264px | 收窄至 220px | 转抽屉，汉堡 `.is-rail-open` | 全屏抽屉 |
| `.stage-item` | 完整名称+副标 | 同左 | 同左 | 触控 ≥44，名称不缩到不可读 |
| `.stage-progress` | 底部常驻 | 同左 | 抽屉内显示 | 同左 |
| `.stage-view` | padding 充裕 | 略减 | 单列 | padding=space-4 |
| `.role-grid` | 自适应多列 | 2 列 | 1–2 列 | 单列 |
| `.role-card` | min 240 并排 | 2 列 | 单列堆叠 | 单列，预算条保留 |
| `.stage-io` | 输入/输出两列 | 两列 | 单列 | 单列 |
| `.biz-shell` | 左 nav + 右页 | 同左 | nav 横向滚动 | 单列，nav 横向滚动 |
| `.procurement-table` | 全列 | 全列 | 可横向滚动/精简 | 字号 compact，可横滚，关键列优先 |
| `.adversarial-board` | 三列并排 | 三列 | 单列堆叠 | 单列，间距 space-3 |
| `.cruise-view` | 两列 | 两列 | 单列 | 单列 |
| `.contract-review` | tabs + 面板 | 同左 | tabs 横向滚动 | 同左，锁横幅全宽 |
| `.evidence-chain` | 横向链 | 换行 | 纵向 | 纵向 |
| `.delivery-report` | 统计网格多列 | 2 列 | 2 列 | 单列 |
| `.drawer` | 420px 侧抽屉 | 同左 | min(420,92vw) | 100vw 全屏 |
| `.log-viewer/.code-block` | 限高滚动 | 同左 | 同左 | 等宽字号更小，保留横滚 |
| `.pagination` | 完整数字 | 同左 | 省略部分数字 | 仅上/下+当前 |
| `.segmented` | 全段 | 同左 | 可横滚 | 触控 ≥44 |

## 3. 布局规则

- **可滚动优先于截断**：表格/diff/代码在窄屏用横向滚动并保留上下文，不删关键列；
  必须删列时先删次要列，状态/金额/主键优先保留。
- 容器用 `minmax(0,1fr)` 防止 grid 子项溢出；长文本 `overflow-wrap`，不撑破布局。
- 多列转单列的顺序保持阅读逻辑（主内容在前，辅助/证据在后）。
- 玻璃/阴影在窄屏不叠加多层，避免脏；抽屉内用实底表面保证可读。

## 4. 触控与安全区

- 触控目标最小 44px（`--rp-touch-target`）：工段、分段、分页、按钮、锚点 nav。
- 移动端底部预留安全区，composer/按钮不被系统条遮挡；抽屉关闭按钮拇指可达。
- 悬停态（tooltip）在触屏不可用，关键信息必须有常驻可见替代。

## 5. 验证方法（headless 多尺寸）

- 用 Chrome headless 对 `preview/v4-factory-demo.html` 分别截：1440、1024、768、390 宽。
- 检查点：无横向溢出（除明确可横滚的表格/代码）、无重叠、触控高度、文字不截断成乱码。
- 深色主题在每个断点同样验证一次。
- 命令示例（PowerShell）：

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --disable-gpu --window-size=390,1400 `
  --screenshot="out-390.png" "v4-factory-demo.html"
```

## 6. 红线

- 不做"手机端隐藏核心证据/状态"的偷懒；阻断、失败、预算在小屏同样可见。
- 不用固定像素宽导致横向溢出；布局基于 token 与弹性/网格。
- `prefers-reduced-motion` 下抽屉/面板切换不依赖动效传达状态（配合 aria-expanded）。
