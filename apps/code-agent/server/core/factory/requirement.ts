import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import type { ContractBundle, ContractKind } from "../../../shared/contracts.ts"

/**
 * 项目需求包：让工厂不只服务内置采购域。
 * 项目根放 `.panshi/requirement.json`，阶段 5/6 会据此生成契约、原型与代码。
 */
export const RequirementAnchorSchema = z.object({
  id: z.string().min(3).regex(/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/, "锚点形如 domain.action"),
  label: z.string().min(1),
  route: z.string().startsWith("/"),
  scope: z.string().min(1).optional(),
  method: z.enum(["get", "post", "put", "patch", "delete"]).default("get"),
  entity: z.string().optional(),
  file: z.string().optional(),
})

export const RequirementSchema = z.object({
  product: z.string().min(1),
  productEn: z.string().optional(),
  description: z.string().max(240).optional(),
  entities: z.array(z.object({
    table: z.string().regex(/^[a-z][a-z0-9_]*$/, "表名使用 snake_case"),
    label: z.string().max(40).optional(),
    fields: z.array(z.object({ name: z.string().regex(/^[a-z][a-z0-9_]*$/), type: z.string() })).min(1),
  })).min(1),
  anchors: z.array(RequirementAnchorSchema).min(3).max(12),
})

export type ProjectRequirement = z.infer<typeof RequirementSchema>
export type RequirementAnchor = z.infer<typeof RequirementAnchorSchema>

export const REQUIREMENT_PATH = ".panshi/requirement.json"

/** 读取项目需求包；没有则返回 null，沿用内置采购域契约。 */
export async function loadRequirement(repoRoot: string): Promise<ProjectRequirement | null> {
  let raw = ""
  try {
    raw = await readFile(join(repoRoot, REQUIREMENT_PATH), "utf8")
  } catch {
    return null
  }
  const parsed = RequirementSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    throw new Error(`${REQUIREMENT_PATH} 不合法：${parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("；")}`)
  }
  return parsed.data
}

const SQL_TYPES: Record<string, string> = {
  text: "VARCHAR(200)",
  string: "VARCHAR(200)",
  int: "INTEGER",
  integer: "INTEGER",
  bigint: "BIGINT",
  uuid: "UUID",
  bool: "BOOLEAN",
  boolean: "BOOLEAN",
  numeric: "NUMERIC(14, 2)",
  timestamptz: "TIMESTAMPTZ",
  date: "DATE",
}

function sqlType(type: string): string {
  return SQL_TYPES[type.toLowerCase()] ?? "TEXT"
}

export function buildRequirementSchema(req: ProjectRequirement): string {
  const tables = req.entities.map((entity) => {
    const fields = entity.fields
      .filter((field) => !["id", "created_at"].includes(field.name))
      .map((field) => `  ${field.name} ${sqlType(field.type)}`)
      .join(",\n")
    return `CREATE TABLE ${entity.table} (\n  id BIGSERIAL PRIMARY KEY${fields ? `,\n${fields}` : ""},\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);`
  })
  return `-- schema.sql · ${req.product}\n-- 由 ${REQUIREMENT_PATH} 生成（PostgreSQL 方言）\n\n${tables.join("\n\n")}\n`
}

function pascal(id: string): string {
  return id.split(/[^a-zA-Z0-9]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")
}

export function buildRequirementOpenApi(req: ProjectRequirement): string {
  const paths = req.anchors.map((anchor) => {
    const path = `/api${anchor.route}`
    const security = anchor.scope ? `\n      security:\n        - rbac: [${anchor.scope}]` : ""
    const status = anchor.method === "post" ? "201" : "200"
    return `  ${path}:\n    ${anchor.method}:\n      operationId: ${anchor.id.replace(/[^a-zA-Z0-9]/g, "_")}${security}\n      responses:\n        "${status}":\n          description: ok`
  })
  return `openapi: 3.0.3
info:
  title: ${req.product} API (MVP)
  version: 1.0.0
paths:
${paths.join("\n")}
components:
  securitySchemes:
    rbac:
      type: apiKey
      in: header
      name: X-RBAC-Role
`
}

export function buildRequirementTree(req: ProjectRequirement): string {
  const tree = {
    version: 1,
    product: req.product,
    anchors: req.anchors.map((anchor) => ({
      id: anchor.id,
      label: anchor.label,
      route: anchor.route,
      rbac: anchor.scope ?? null,
      method: anchor.method,
      file: anchor.file ?? `src/views/${pascal(anchor.id)}.vue`,
    })),
  }
  return `${JSON.stringify(tree, null, 2)}\n`
}

export function buildRequirementContracts(req: ProjectRequirement): Record<ContractKind, string> {
  return {
    "schema.sql": buildRequirementSchema(req),
    "openapi.yaml": buildRequirementOpenApi(req),
    "component_tree.json": buildRequirementTree(req),
  }
}

export function validateRequirementContracts(req: ProjectRequirement, contents: Record<string, string>): ContractBundle["validation"] {
  const sql = contents["schema.sql"] ?? ""
  const openapi = contents["openapi.yaml"] ?? ""
  const tree = contents["component_tree.json"] ?? ""

  const sqlErrors: string[] = []
  for (const entity of req.entities) {
    if (!new RegExp(`CREATE TABLE\\s+${entity.table}\\b`, "i").test(sql)) sqlErrors.push(`缺少表 ${entity.table}`)
  }
  if ((sql.match(/\(/g) ?? []).length !== (sql.match(/\)/g) ?? []).length) sqlErrors.push("括号不配对")
  if (/DROP\s+DATABASE/i.test(sql)) sqlErrors.push("禁止 DROP DATABASE")

  const openapiErrors: string[] = []
  if (!/^openapi:\s*3\./m.test(openapi)) openapiErrors.push("缺少 openapi 3.x 版本声明")
  for (const anchor of req.anchors) {
    if (!openapi.includes(`/api${anchor.route}:`)) openapiErrors.push(`缺少路由 /api${anchor.route}`)
  }
  if (!/rbac:/.test(openapi)) openapiErrors.push("写操作缺少 RBAC 声明")

  const treeErrors: string[] = []
  try {
    const parsed = JSON.parse(tree) as { anchors?: Array<{ id?: string; route?: string; rbac?: string | null; file?: string }> }
    const anchors = parsed.anchors ?? []
    for (const anchor of req.anchors) {
      const found = anchors.find((item) => item.id === anchor.id)
      if (!found) treeErrors.push(`缺少锚点 ${anchor.id}`)
      else if (!found.route || !found.file) treeErrors.push(`锚点 ${anchor.id} 字段不完整`)
    }
    if (new Set(anchors.map((item) => item.id)).size !== anchors.length) treeErrors.push("锚点 ID 重复")
  } catch {
    treeErrors.push("component_tree.json 不是合法 JSON")
  }

  return [
    { kind: "schema.sql", ok: sqlErrors.length === 0, errors: sqlErrors },
    { kind: "openapi.yaml", ok: openapiErrors.length === 0, errors: openapiErrors },
    { kind: "component_tree.json", ok: treeErrors.length === 0, errors: treeErrors },
  ]
}
