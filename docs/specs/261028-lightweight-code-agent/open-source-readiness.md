# 开源发布准备与合规门禁

## 1. 目标

让未来的 Coding Agent 能以独立、可审计的方式发布为开源项目。这里的“可开源”指：代码边界、来源、第三方依赖、生成资产和发布许可证都可以被维护者解释和复核。

这套流程降低抄袭和许可证违规风险，但不能替代发布前的人工或专业法律审查。

## 2. 产品边界

当前父仓库是大型 Blade Agent monorepo，根目录没有统一的 `LICENSE` 文件。因此不能直接把本方案目录或未来 `apps/code-agent/` 口头宣布为一个已经独立授权的产品。

实现阶段应在以下两种方式中选择一种：

### 方式 A：独立仓库

将 Coding Agent 放入单独仓库，拥有自己的：

- `LICENSE`
- `NOTICE`
- `THIRD_PARTY_NOTICES.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- SBOM 和发布流程

这是最清晰的开源边界。

### 方式 B：当前 monorepo 子项目

继续放在 `apps/code-agent/`，但必须明确：

- 哪些目录属于 Coding Agent。
- 哪些代码属于父仓库平台，不得随产品一起发布。
- 子项目是否拥有单独许可证，还是继承父仓库后续确定的许可证。
- 发布包是否包含父仓库内部代码、私有资源或品牌资产。

在这些问题确定前，不发布二进制或源代码包。

## 3. 推荐许可证策略

如果目标是鼓励社区贡献、允许商业集成，同时保留明确的专利授权边界，建议优先评估 Apache-2.0；如果只追求最短的使用条件，可以评估 MIT。

最终许可证不能只根据参考项目决定，必须结合产品代码、依赖、商标和专利策略单独确定。

当前调研中：OpenHands Software Agent SDK 使用 MIT；SWE-agent 使用 MIT；Cline、Continue 和 Goose 使用 Apache-2.0。许可证只适用于相应仓库或组件，不能推断整个生态统一使用同一许可证。[OpenHands SDK LICENSE](https://raw.githubusercontent.com/OpenHands/software-agent-sdk/main/LICENSE) [SWE-agent LICENSE](https://raw.githubusercontent.com/SWE-agent/SWE-agent/main/LICENSE) [Cline LICENSE](https://raw.githubusercontent.com/cline/cline/main/LICENSE) [Continue LICENSE](https://raw.githubusercontent.com/continuedev/continue/main/LICENSE) [Goose LICENSE](https://raw.githubusercontent.com/aaif-goose/goose/main/LICENSE)

## 4. 开发期门禁

### 4.1 来源门禁

- 每个外部参考写入 `references.md` 和来源台账。
- 只采纳架构、协议和公开行为，不复制实现细节。
- 不复制第三方 Prompt、UI 文案、图标、CSS、测试夹具、截图、数据集和品牌名称。
- 不把第三方仓库源码作为模型上下文，要求模型“改写成自己的版本”。
- 需要复用源码时必须停止普通开发流程，建立单独的复用审查记录。

### 4.2 依赖门禁

- 所有直接和传递依赖都要记录名称、版本、来源和许可证。
- 依赖升级必须重新生成许可证清单和 SBOM。
- 未声明许可证的依赖默认不进入发布包。
- GPL/AGPL 等有额外分发义务的依赖不能进入核心发布包，除非已经完成单独的兼容性决策。
- 第三方服务、模型、字体、图标和模板也要列入发布清单，不能只扫描 npm/pip 包。

### 4.3 生成内容门禁

- 记录模型名称、版本、Provider、主要输入来源和生成时间。
- 生成代码必须经过测试和人工 diff 审查。
- 对大段复制、独特注释、特殊命名和第三方许可证文本做相似性扫描。
- 评估仓库使用自建 fixture 或确认允许再分发的项目。
- 不把模型输出自动宣传为“无第三方影响”。

## 5. 发布物要求

正式发布前至少具备：

- `LICENSE`
- `NOTICE`
- `THIRD_PARTY_NOTICES.md`
- SPDX 或 CycloneDX 格式 SBOM
- 依赖许可证扫描报告
- 源码和发布包的版本对应关系
- 构建脚本和可复现的依赖锁定
- `CONTRIBUTING.md` 和贡献者版权声明策略
- `SECURITY.md`
- 商标和品牌使用说明
- 不包含 API Key、用户仓库、私有 Prompt、内部 URL 和测试凭据

## 6. 发布前检查清单

```text
[ ] 已决定产品代码的许可证
[ ] 已确认产品目录边界
[ ] 已完成来源台账
[ ] 已完成直接依赖和传递依赖扫描
[ ] 已生成 SBOM
[ ] 已生成 THIRD_PARTY_NOTICES.md
[ ] 已核对字体、图标、模板和数据集许可
[ ] 已扫描源码中的第三方版权片段
[ ] 已检查 Prompt、UI、测试夹具和品牌资产没有复制
[ ] 已移除密钥、真实仓库、内部地址和私有配置
[ ] 已完成可复现构建
[ ] 已完成人工发布审查
```

## 7. 可审计目录建议

实现仓库可以增加：

```text
compliance/
├─ sources.yaml
├─ dependencies.spdx.json
├─ similarity-review.md
├─ generated-assets.md
└─ release-checklist.md
```

这些文件不进入运行时上下文，不影响 Agent 的产品行为，只用于维护和发布审计。
