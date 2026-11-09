# RepoPilot Lite 设计系统

## 1. 视觉方向

产品采用“安静的证据工作台”方向：适合长时间阅读代码、查看命令和比较变更，强调清晰层级和状态可信度，不使用霓虹、渐变、玻璃堆叠或聊天产品的气泡化布局。

这不是 OmniDirector 的视觉迁移。它只借鉴了对方“环境层、token、组件语义、状态反馈和验收清单”的方法，重新定义颜色、排版、页面职责和组件名称。

## 2. Token 基线

### 颜色

```css
:root {
  --rp-bg: #f4f5f2;
  --rp-surface: #ffffff;
  --rp-surface-muted: #ecefea;
  --rp-surface-raised: #ffffff;
  --rp-text: #172027;
  --rp-text-secondary: #52606a;
  --rp-text-muted: #78848b;
  --rp-border: #d7ddd9;
  --rp-border-strong: #aeb8b3;
  --rp-accent: #4f6fe8;
  --rp-accent-strong: #3655c7;
  --rp-accent-ink: #ffffff;
  --rp-focus: #2b65d9;
  --rp-ok: #2f8a67;
  --rp-warn: #b87921;
  --rp-danger: #c95656;
  --rp-info: #467b9f;
}

[data-theme="dark"] {
  --rp-bg: #101315;
  --rp-surface: #171b1e;
  --rp-surface-muted: #202629;
  --rp-surface-raised: #242b2f;
  --rp-text: #edf1ee;
  --rp-text-secondary: #b5c0c1;
  --rp-text-muted: #839093;
  --rp-border: #303a3e;
  --rp-border-strong: #526166;
  --rp-accent: #87a0ff;
  --rp-accent-strong: #a5b7ff;
  --rp-accent-ink: #11151a;
  --rp-focus: #9eb5ff;
  --rp-ok: #6ac19d;
  --rp-warn: #e3ae5b;
  --rp-danger: #ef8585;
  --rp-info: #87b3d0;
}
```

蓝色只表达主动作、当前选中、焦点和链接；成功、警告、失败和信息使用独立低饱和状态色。状态不能只靠颜色表达。

### 排版

- UI 正文：IBM Plex Sans 或系统无衬线，14–16px，行高 1.5–1.65。
- 代码、路径、命令、ID、时间：JetBrains Mono，12–14px。
- 页面标题：IBM Plex Sans 600，20–28px；不使用装饰性衬线。
- 标签使用句式大小写，不使用全大写追踪字距。
- 正文行长控制在 60–80 个字符，命令输出允许水平滚动。

### 间距、圆角和层级

```text
spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40
radius: 6px 控件、10px 面板、14px sheet/modal、999px 状态点
border: 1px 常规，2px focus/error/selected
shadow: 仅浮层和拖拽对象；普通面板靠背景层和边框分隔
```

## 3. 组件视觉规则

- 页面只保留一个主动作，其余动作使用次要、文字或危险层级。
- 面板不做相同半径的卡片网格；主工作面、侧栏和浮层需要不同层级。
- 代码和终端区域使用 `--rp-surface-muted`，不能把深色代码块放在浅色正文里而没有边界。
- 状态组件同时包含文字、图标/形状和颜色。
- 加载状态保留结构空间，使用骨架或阶段说明，不使用无限旋转作为唯一反馈。
- 空态说明原因和下一步；错误说明原因、影响和恢复操作。

## 4. 动效

- 默认 120–180ms，`ease-out`。
- 只在状态变化、面板打开、事件追加和焦点转移时使用动效。
- 事件流可以有轻微新消息标记，但不让所有行持续脉冲。
- 不动画主要容器的 width/height；面板展开使用离散布局或 transform。
- `prefers-reduced-motion: reduce` 时直接呈现最终状态，保留必要的焦点移动。

## 5. 可访问性

- 所有交互控件具有可访问名称。
- `:focus-visible` 至少 2px 外环，不能被 sticky header 或 sheet 遮挡。
- 任务状态和命令结果使用 `aria-live` 或 `role="status"`，错误使用 `role="alert"`。
- 选项卡、切换、审批和可折叠区域使用原生语义或明确的 ARIA 状态。
- 触控目标不小于约 44×44px；桌面紧凑工具栏也应保留可操作间距。
- 对比度以 WCAG AA 为底线，弱文字不能承载唯一关键提示。
