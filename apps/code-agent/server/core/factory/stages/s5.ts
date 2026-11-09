import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { ContractBundleSchema, type ContractBundle } from "../../../../shared/contracts.ts"
import type { StageContext, StageResult } from "../types.ts"
import { ensureDir } from "../../fs-utils.ts"
import { buildContracts, hashContracts, validateContracts } from "../procurement.ts"
import { buildPrototypeHtml, type PrototypeAnchor } from "../prototype.ts"
import { buildRequirementContracts, loadRequirement, validateRequirementContracts } from "../requirement.ts"

/** Stage 5：生成三份契约 → 校验 → 哈希 → 锁定（需显式确认）。 */
export async function runStage5(ctx: StageContext): Promise<StageResult> {
  if (!ctx.confirm) {
    return { status: "blocked", code: "confirmation_required", message: "契约锁定属于写入动作，需要二次确认" }
  }
  await ctx.emit("approval.requested", { stage: 5, kind: "contract_lock", subject: "锁定三份契约", at: new Date().toISOString() })

  // 项目自带 `.panshi/requirement.json` 时按需求生成；否则沿用内置采购域契约。
  const requirement = await loadRequirement(ctx.repoRoot)
  const contents = requirement ? buildRequirementContracts(requirement) : buildContracts()
  const validation = requirement ? validateRequirementContracts(requirement, contents) : validateContracts(contents)

  for (const item of validation) {
    await ctx.emit("contract.validate", { kind: item.kind, ok: item.ok, errors: item.errors })
  }
  const failed = validation.filter((item) => !item.ok)
  if (failed.length > 0) {
    return { status: "failed", code: "contract_invalid", message: failed.map((item) => `${item.kind}: ${item.errors.join("; ")}`).join(" | ") }
  }

  const hash = hashContracts(contents)
  const version = 1
  const dir = join(ctx.store.contractsRoot(), hash)
  await ensureDir(dir)
  const artifacts = []
  for (const [kind, content] of Object.entries(contents)) {
    await writeFile(join(dir, kind), content, "utf8")
    artifacts.push(await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 5, name: kind, kind: kind === "schema.sql" ? "schema" : kind === "openapi.yaml" ? "openapi" : "component-tree", content }))
  }
  const bundle: ContractBundle = { version, hash, kinds: ["schema.sql", "openapi.yaml", "component_tree.json"], locked: true, contents, validation, lockedAt: new Date().toISOString() }
  ContractBundleSchema.parse(bundle)
  await writeFile(join(ctx.store.contractsRoot(), "bundle.json"), JSON.stringify(bundle, null, 2), "utf8")
  artifacts.push(await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 5, name: "contract-bundle.json", kind: "evidence", content: JSON.stringify(bundle, null, 2) }))
  await ctx.emit("contract.locked", { kinds: bundle.kinds, hash, version, lockedAt: bundle.lockedAt })

  const anchorList: PrototypeAnchor[] | undefined = requirement?.anchors.map((anchor) => ({ id: anchor.id, label: anchor.label, route: anchor.route, scope: anchor.scope ?? null, method: anchor.method }))
  const prototypeHtml = buildPrototypeHtml(version, hash, anchorList, requirement?.product)
  const prototypeArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 5, name: "prototype.html", kind: "other", content: prototypeHtml })
  artifacts.push(prototypeArtifact)
  await ctx.emit("prototype.ready", {
    path: prototypeArtifact.path,
    anchors: anchorList?.length ?? 7,
    screens: anchorList?.length ?? 7,
    hash,
    version,
    product: requirement?.product ?? "采购与固定资产管理",
    ...(anchorList ? { anchorList } : {}),
    ...(requirement ? { entities: requirement.entities } : {}),
  })
  await ctx.emit("approval.resolved", { stage: 5, kind: "contract_lock", subject: "锁定三份契约", decision: "approved", actor: "operator", hash, at: new Date().toISOString() })

  return {
    status: "succeeded",
    artifacts,
    notes: [
      `契约版本 v${version}，哈希 ${hash.slice(0, 12)}，三份校验全部通过`,
      requirement ? `需求包：${requirement.product}（${requirement.entities.length} 个实体 / ${requirement.anchors.length} 个锚点）` : "内置采购域契约",
    ],
  }
}
