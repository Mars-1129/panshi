# 前端 Skills 调研与借鉴边界

## 1. 本地 Skill 的可借鉴部分

`new/New-F-UI-Skills/omnidirector-ui-style` 是一个产品专用 Skill。它的价值主要在于组织方式：

- `SKILL.md` 只保留触发条件、工作方法和不可违反的规则。
- `references/design-system.md` 维护 token、排版、材质、动效和响应式规则。
- `references/component-catalog.md` 维护可组合的组件与交互语义。
- `references/page-map.md` 维护路由、页面职责和状态边界。
- `references/implementation-checklist.md` 把视觉验收转成可勾选证据。
- `references/source-map.md` 指向真实代码来源，避免 Skill 与实现脱节。

应当借鉴这种“规则分层和按需读取”的方式；不能借鉴它的 OmniDirector 品牌、电影化视觉、金色动作语言、群聊/Drama/星系页面语义或任何源码和文案。

## 2. GitHub 开源 Frontend Skill 调研

| 项目 | 观察到的做法 | RepoPilot Lite 采用方式 |
| --- | --- | --- |
| [Agent Skills 规范](https://agentskills.io/specification) | `SKILL.md` 必须有 frontmatter；支持 `references/`、`scripts/`、`assets/`；渐进式加载；主文件建议控制在 500 行以内；可用 `skills-ref validate` 校验 | 使用标准 metadata；正文只保留工作契约；详细视觉、组件和验收规则放 references |
| [frontend-ai-skills](https://github.com/JustineBijuPaul/frontend-ai-skills) | 按独立 Skill 目录组织，提供 manifest、安装脚本和验证脚本，支持按类别安装 | 维护明确的 Skill 清单和版本；未来再按 React、a11y、测试拆分，不一次加载全部内容 |
| [react-frontend-skills](https://github.com/PyModel/react-frontend-skills) | 每个 Skill 通过 references/rules 延伸；提供版本识别和废弃 API 扫描等确定性 CLI | 把“能由机器检查的规则”做成脚本或测试，不把所有约束写成 Prompt |
| [event4u agent-config / fe-design](https://github.com/event4u-app/agent-config/blob/main/src/skills/fe-design/SKILL.md) | 先审查现有 UI，再生成 brief、组件、状态、文案和 a11y；强调证据和来源治理 | 新页面先做页面职责、状态矩阵和设计 brief，再进入组件实现 |
| [PracticalSwan frontend-design](https://github.com/PracticalSwan/agent-skills/blob/main/frontend-design/SKILL.md) | 把完整状态、可访问性、响应式、性能和渲染后验证作为组件审查门槛 | 每个组件验收 loading/empty/error/success/disabled/stale/permission 和真实宽度渲染 |
| [clawvpsai frontend-skill](https://github.com/clawvpsai/frontend-skill) | 以一个导航型 `SKILL.md` 连接 setup、components、routing、forms、state、testing 等主题 | 保持一层引用深度；实现阶段按任务只加载相关参考文件 |

## 3. 采用的共同原则

1. **渐进式上下文**：启动时只发现 Skill 名称和 description；激活后读取主规则；实现具体页面时再加载对应 reference。
2. **设计与工程分离**：视觉规则说明“应该怎样”，React/Vite 规则说明“如何实现”；不把框架 API 细节塞进设计 Skill。
3. **完整状态优先**：任何页面和组件都必须有空、加载、错误、成功、禁用、阻塞、断线和窄屏策略。
4. **确定性验证**：版本检测、类型检查、lint、截图、键盘流程和响应式检查由工具或测试完成。
5. **证据优先**：UI 只展示后端/运行时真实状态，不用动画或颜色伪造完成度。

## 4. 不采用的做法

- 不复制任何开源 Skill 的源码、Prompt、章节原文、UI 文案或页面截图。
- 不把 70+ 个通用 Skill 整包加入产品，避免上下文污染和规则冲突。
- 不把某个框架的默认组件风格当作产品视觉身份。
- 不用“看起来很专业”的动画代替运行状态、错误原因和验证证据。
- 不把第三方产品的品牌名、颜色、布局和命名直接迁移到 RepoPilot Lite。

## 5. RepoPilot Lite 的 Skill 组合

第一阶段只提供一个基线 Skill：

```text
repopilot-frontend
├─ design-system
├─ component-catalog
├─ page-map
├─ state-and-flows
└─ implementation-checklist
```

后续在规则稳定后再拆成：

- `repopilot-react`
- `repopilot-accessibility`
- `repopilot-testing`
- `repopilot-performance`

拆分的依据是不同任务是否需要独立加载，而不是为了增加 Skill 数量。

## 6. 许可证与原创边界

本调研只引用公开文档和项目结构。GitHub 项目的许可证只约束对应项目的代码与资产，不授予复制其他项目的 Prompt、品牌或 UI 的权利。RepoPilot Lite 的 Skill、设计 token、组件名、页面信息架构和验收文案均重新设计；未来发布时按 `open-source-readiness.md` 做依赖和来源审计。
