import { spawnSync } from "node:child_process"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import { RequirementSchema, REQUIREMENT_PATH, type ProjectRequirement, type RequirementAnchor } from "./factory/requirement.ts"

export type DraftField = { name: string; type: string }
export type DraftEntity = { table: string; label?: string; fields: DraftField[] }
export type ProjectDraft = {
  product: string
  description?: string
  entities: DraftEntity[]
  anchors?: RequirementAnchor[]
}

export type ProjectInfo = {
  id: string
  path: string
  product: string
  description: string
  anchors: number
  updatedAt: string
}

const FIELD_TYPES = new Set(["text", "int", "bigint", "uuid", "boolean", "numeric", "timestamptz", "date"])

function hyphen(table: string): string {
  return table.replaceAll("_", "-")
}

/** 从实体推导页面锚点：每个实体一个列表页 + 一个新建页，再加三个通用页。 */
export function deriveAnchors(entities: DraftEntity[]): RequirementAnchor[] {
  const anchors: RequirementAnchor[] = []
  for (const entity of entities) {
    const domain = entity.table.split("_")[0] ?? entity.table
    const label = entity.label?.trim() || entity.table
    anchors.push({
      id: `${domain}.list`,
      label: `${label}列表`,
      route: `/${hyphen(entity.table)}`,
      scope: `${domain}:read`,
      method: "get",
      entity: entity.table,
    })
    anchors.push({
      id: `${domain}.create`,
      label: `新建${label}`,
      route: `/${hyphen(entity.table)}`,
      scope: `${domain}:create`,
      method: "post",
      entity: entity.table,
    })
  }
  const first = entities[0]?.table.split("_")[0] ?? "app"
  anchors.push(
    { id: "approval.timeline", label: "审批时间线", route: "/approvals", scope: `${first}:read`, method: "get" },
    { id: "usage.summary", label: "使用统计", route: "/usage", scope: `${first}:read`, method: "get" },
    { id: "settings.update", label: "系统设置", route: "/settings", scope: `${first}:admin`, method: "put" },
  )
  return anchors
}

export function buildRequirement(draft: ProjectDraft): ProjectRequirement {
  if (!draft.product.trim()) throw new Error("项目名称不能为空")
  if (draft.entities.length === 0) throw new Error("至少需要一个数据实体")
  const entities = draft.entities.map((entity) => {
    if (!/^[a-z][a-z0-9_]*$/.test(entity.table)) throw new Error(`表名需为 snake_case：${entity.table}`)
    if (entity.fields.length === 0) throw new Error(`实体 ${entity.table} 至少需要一个字段`)
    for (const field of entity.fields) {
      if (!/^[a-z][a-z0-9_]*$/.test(field.name)) throw new Error(`字段名需为 snake_case：${field.name}`)
      if (!FIELD_TYPES.has(field.type)) throw new Error(`不支持的字段类型：${field.type}`)
    }
    return { table: entity.table, fields: entity.fields }
  })
  const anchors = draft.anchors && draft.anchors.length > 0 ? draft.anchors : deriveAnchors(draft.entities)
  return RequirementSchema.parse({
    product: draft.product.trim(),
    ...(draft.description ? { description: draft.description } : {}),
    entities,
    anchors,
  })
}

function slugify(product: string): string {
  return product.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true })
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`)
}

function scaffoldFiles(requirement: ProjectRequirement, slug: string, description: string): Record<string, string> {
  const domain = requirement.entities[0]?.table.split("_")[0] ?? "app"
  const anchors = requirement.anchors.map((anchor) => `- ${anchor.label}（${anchor.id}）：${anchor.method.toUpperCase()} ${anchor.route} · ${anchor.scope ?? "public"}`).join("\n")
  return {
    [REQUIREMENT_PATH]: `${JSON.stringify(requirement, null, 2)}\n`,
    "package.json": `${JSON.stringify({ name: slug, version: "0.1.0", private: true, type: "module", description, scripts: { test: "node --test" } }, null, 2)}\n`,
    "README.md": `# ${requirement.product}\n\n${description}\n\n由 PanShi-SwarmFactory 创建。需求包：\`${REQUIREMENT_PATH}\`。\n\n## 页面锚点\n\n${anchors}\n`,
    "src/domain.mjs": `/**\n * 领域规则骨架：由 PanShi 创建，后续由工厂在阶段 02/06 补充。\n */\nexport function describe${domain.charAt(0).toUpperCase()}${domain.slice(1)}(input) {\n  return String(input ?? "")\n}\n`,
    [`test/${domain}.test.mjs`]: `import test from "node:test"\nimport assert from "node:assert/strict"\nimport { describe${domain.charAt(0).toUpperCase()}${domain.slice(1)} } from "../src/domain.mjs"\n\ntest("领域骨架可运行", () => {\n  assert.equal(describe${domain.charAt(0).toUpperCase()}${domain.slice(1)}("ok"), "ok")\n})\n`,
    ".gitignore": "node_modules/\n.repo-agent/\n.repopilot/\ndist/\n",
  }
}

/** 在项目根下创建可运行的新项目仓库（含需求包 + 骨架 + 初始提交）。 */
export async function createProjectDir(projectsRoot: string, draft: ProjectDraft): Promise<{ path: string; requirement: ProjectRequirement }> {
  const requirement = buildRequirement(draft)
  const slug = slugify(draft.product) || draft.entities[0]?.table || "project"
  let target = resolve(projectsRoot, slug)
  let suffix = 2
  while (await exists(target)) {
    target = resolve(projectsRoot, `${slug}-${suffix}`)
    suffix += 1
  }
  await mkdir(target, { recursive: true })
  const files = scaffoldFiles(requirement, basename(target), draft.description?.trim() ?? requirement.product)
  for (const [path, content] of Object.entries(files)) {
    const full = join(target, path)
    await mkdir(join(full, ".."), { recursive: true })
    await writeFile(full, content, "utf8")
  }
  git(target, ["init", "-q"])
  git(target, ["config", "user.name", "PanShi Factory"])
  git(target, ["config", "user.email", "factory@localhost"])
  git(target, ["config", "commit.gpgsign", "false"])
  git(target, ["add", "-A"])
  git(target, ["commit", "-q", "--no-verify", "-m", `init: ${requirement.product}`])
  return { path: target, requirement }
}

export async function listProjects(projectsRoot: string): Promise<ProjectInfo[]> {
  const out: ProjectInfo[] = []
  let entries: Array<{ name: string; isDirectory: () => boolean }> = []
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const path = resolve(projectsRoot, entry.name)
    try {
      const raw = await readFile(join(path, REQUIREMENT_PATH), "utf8")
      const parsed = RequirementSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) continue
      out.push({
        id: entry.name,
        path,
        product: parsed.data.product,
        description: parseDescription(raw),
        anchors: parsed.data.anchors.length,
        updatedAt: (await statMtime(path)).toISOString(),
      })
    } catch {
      // not a PanShi project
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function parseDescription(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { description?: string }
    return parsed.description ?? ""
  } catch {
    return ""
  }
}

async function statMtime(path: string): Promise<Date> {
  const { stat } = await import("node:fs/promises")
  try {
    return (await stat(path)).mtime
  } catch {
    return new Date(0)
  }
}

async function exists(path: string): Promise<boolean> {
  const { stat } = await import("node:fs/promises")
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
