import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { StageContext, StageResult } from "../types.ts"
import { ensureDir } from "../../fs-utils.ts"
import type { Artifact } from "../../../../shared/contracts.ts"
import { loadRequirement, type ProjectRequirement } from "../requirement.ts"
import { openApiSecuredRoutes, generatedRoutes } from "../rails.ts"

type RolePlan = { role: string; dir: string; files: Array<{ path: string; content: string }> }
type BackendFile = { path: string; content: string }

const BACKEND_ROUTES = [
  { method: "GET", route: "/api/procurement/orders", scope: null },
  { method: "POST", route: "/api/procurement/orders", scope: "procurement:create" },
  { method: "POST", route: "/api/procurement/orders/{id}/approve", scope: "procurement:submit" },
  { method: "GET", route: "/api/inventory/summary", scope: null },
  { method: "GET", route: "/api/budget/dashboard", scope: null },
]

const BACKEND_SERVER = `// 由 Backend Builder 生成：路由与 RBAC 严格来自 openapi.yaml
// @require_rbac_permission(scope)
export const routes = [
${BACKEND_ROUTES.map((route) => `  { method: "${route.method}", route: "${route.route}"${route.scope ? `, rbac: "${route.scope}"` : ""}, handler: (req, res) => res.json({ ok: true, route: "${route.route}" }) },`).join("\n")}
]

export function handle(method, path, req, res) {
  const route = routes.find((item) => item.method === method && item.route === path)
  if (!route) {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not_found" }))
    return
  }
  route.handler(req, res)
}
`

const FRONTEND_TABLE = `<!-- 由 Frontend Builder 生成：锚点来自 component_tree.json -->
<template>
  <section data-panshi-id="procurement.table">
    <h1>采购订单</h1>
    <table data-panshi-id="procurement.create">
      <thead><tr><th>单号</th><th>金额</th><th>状态</th></tr></thead>
      <tbody><tr><td>PO-2024-001</td><td>￥128,000</td><td>待审批</td></tr></tbody>
    </table>
    <button data-panshi-id="procurement.invoice_verify">发票验真</button>
    <button data-panshi-id="procurement.submit">提交审批</button>
    <ol data-panshi-id="approval.timeline"><li>经理审批</li><li>财务复核</li></ol>
    <p data-panshi-id="inventory.summary">库存 10 台</p>
    <p data-panshi-id="budget.dashboard">预算执行 62%</p>
  </section>
</template>
`

function pascal(value: string): string {
  return value.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")
}

function seedFor(requirement: ProjectRequirement): string {
  return requirement.entities.map((entity) => {
    const fields = entity.fields.filter((field) => !["id", "created_at"].includes(field.name))
    const columns = fields.map((field) => field.name).join(", ")
    const values = fields.map((field) => (/int|numeric|bigint|bool/i.test(field.type) ? "1" : field.type.toLowerCase() === "date" ? "'2026-01-01'" : "'示例'")).join(", ")
    return `INSERT INTO ${entity.table} (${columns}) VALUES (${values});`
  }).join("\n")
}

/** 需求包驱动：7 个锚点 → 7 条路由 + 7 个 Vue 页面。 */
function requirementPlans(requirement: ProjectRequirement, schema: string, anchors: string[]): RolePlan[] {
  const backendRoutes = requirement.anchors.map((anchor) => ({
    method: anchor.method.toUpperCase(),
    route: `/api${anchor.route.startsWith("/") ? anchor.route : `/${anchor.route}`}`,
    scope: anchor.scope ?? null,
  }))
  const server = `// 由 Backend Builder 生成：路由与 RBAC 严格来自 component_tree.json
// @require_rbac_permission(scope)
export const routes = [
${backendRoutes.map((route) => `  { method: "${route.method}", route: "${route.route}"${route.scope ? `, rbac: "${route.scope}"` : ""}, handler: (req, res) => res.json({ ok: true, route: "${route.route}" }) },`).join("\n")}
]

export function handle(method, path, req, res) {
  const route = routes.find((item) => item.method === method && item.route === path)
  if (!route) {
    res.statusCode = 404
    res.end(JSON.stringify({ error: "not_found" }))
    return
  }
  route.handler(req, res)
}
`
  const scopes = [...new Set(requirement.anchors.map((anchor) => anchor.scope).filter((scope): scope is string => Boolean(scope)))]
  const vueFiles = requirement.anchors.map((anchor) => ({
    path: `${pascal(anchor.id)}.vue`,
    content: `<!-- 由 Frontend Builder 生成：锚点 ${anchor.id} -->
<template>
  <section data-panshi-id="${anchor.id}" data-route="${anchor.route}">
    <h2>${anchor.label}</h2>
    <p>RBAC：${anchor.scope ?? "公开"}</p>
  </section>
</template>
`,
  }))
  return [
    { role: "Database Builder", dir: "db", files: [{ path: "schema.sql", content: schema }, { path: "seed.sql", content: `${seedFor(requirement)}\n` }] },
    { role: "Backend Builder", dir: "backend", files: [{ path: "server.mjs", content: server }, { path: "rbac.mjs", content: `export const SCOPES = ${JSON.stringify(scopes)}\n` }] },
    { role: "Frontend Builder", dir: "frontend", files: [...vueFiles, { path: "anchors.json", content: `${JSON.stringify(anchors, null, 2)}\n` }] },
  ]
}

function parseBackendFiles(raw: string): BackendFile[] {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim()
  const candidates: unknown[] = []
  try {
    candidates.push(JSON.parse(cleaned))
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        candidates.push(JSON.parse(cleaned.slice(start, end + 1)))
      } catch {
        // ignore malformed output
      }
    }
  }
  for (const candidate of candidates) {
    const files = (candidate as { files?: unknown })?.files
    if (!Array.isArray(files)) continue
    return files
      .filter((item): item is { path: string; content: string } => Boolean(item) && typeof (item as { path?: unknown }).path === "string" && typeof (item as { content?: unknown }).content === "string")
      .map((item) => ({ path: item.path, content: item.content }))
      .filter((item) => /^[A-Za-z0-9._-]+$/.test(item.path))
  }
  return []
}

function validateBackend(files: BackendFile[], openapi: string): string[] {
  const errors: string[] = []
  const server = files.find((item) => item.path.endsWith("server.mjs"))?.content ?? ""
  if (!server) return ["缺少 server.mjs"]
  if (!server.includes("@require_rbac_permission")) errors.push("缺少 RBAC 注解")
  const declared = generatedRoutes(server)
  for (const route of openApiSecuredRoutes(openapi)) {
    const found = declared.find((item) => item.method === route.method && item.path === route.path)
    if (!found) {
      errors.push(`缺少路由 ${route.method} ${route.path}`)
      continue
    }
    if (route.scope && found.scope !== route.scope) errors.push(`路由 ${route.path} 的 rbac 应为 ${route.scope}`)
  }
  return errors
}

async function chatBackend(ctx: StageContext, openapi: string, schema: string, correction: string): Promise<BackendFile[]> {
  if (!ctx.ai.provider) return []
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const turn = await ctx.ai.provider.chat({
      system: "你是政企后端工程师。只输出 server.mjs 的完整代码，不要解释、不要 Markdown 代码块。代码必须导出 routes 数组，元素逐字采用格式：{ method: \"GET\", route: \"/api/procurement/orders\", rbac: \"procurement:read\", handler: (req, res) => res.json({ ok: true }) }；路由与 openapi 完全一致；包含注释 // @require_rbac_permission(scope)。",
      messages: [{ role: "user", content: `openapi.yaml:\n${openapi}\n\nschema.sql:\n${schema}${correction}` }],
      tools: [],
      signal: controller.signal,
    })
    const text = String(turn.text ?? "").replace(/^```[a-z]*\n/i, "").replace(/\n```\s*$/, "").trim()
    return text.includes("routes") ? [{ path: "server.mjs", content: text }] : []
  } finally {
    clearTimeout(timer)
  }
}

async function generateBackendWithAi(ctx: StageContext, bundle: { hash: string; contents: Record<string, string> }): Promise<{ files: BackendFile[]; ok: boolean; error?: string }> {
  if (!ctx.ai.enabled || !ctx.ai.provider) return { files: [], ok: false }
  const openapi = bundle.contents["openapi.yaml"] ?? ""
  const schema = bundle.contents["schema.sql"] ?? ""
  let lastError = ""
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const correction = attempt === 0 ? "" : `\n上次输出未通过契约校验：${lastError}。请只生成 server.mjs，不要生成其他文件，并严格按示例格式重写 routes。`
      const files = await chatBackend(ctx, openapi, schema, correction)
      if (files.length > 0 && !files.some((file) => file.path.endsWith("server.mjs"))) {
        lastError = "模型未返回 server.mjs"
        continue
      }
      if (files.length === 0) {
        lastError = "模型未返回可解析文件"
        continue
      }
      const errors = validateBackend(files, openapi)
      if (errors.length === 0) return { files: [...files, { path: "rbac.mjs", content: `export const SCOPES = ${JSON.stringify([...new Set(openApiSecuredRoutes(openapi).map((route) => route.scope).filter(Boolean))])}\n` }], ok: true }
      lastError = errors.join("；")
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }
  return { files: [], ok: false, error: lastError }
}

/** Stage 6：三个制造角色并发产出，随后合并。产物写入 generated/，不碰用户工作区。 */
export async function runStage6(ctx: StageContext): Promise<StageResult> {
  if (!ctx.confirm) {
    return { status: "blocked", code: "confirmation_required", message: "生成业务代码属于写入动作，需要二次确认" }
  }
  let bundleRaw = ""
  try {
    bundleRaw = await readFile(join(ctx.store.contractsRoot(), "bundle.json"), "utf8")
  } catch {
    return { status: "blocked", code: "contract_not_locked", message: "契约尚未锁定：请先完成 Stage 5" }
  }
  const bundle = JSON.parse(bundleRaw) as { hash: string; contents: Record<string, string> }
  await ctx.emit("approval.requested", { stage: 6, kind: "role_execution", subject: "三角色并发写入 generated/", at: new Date().toISOString() })
  const schema = bundle.contents["schema.sql"] ?? ""
  const anchors = [...(bundle.contents["component_tree.json"] ?? "").matchAll(/"id":\s*"([^"]+)"/g)].map((item) => item[1] ?? "")
  const requirement = await loadRequirement(ctx.repoRoot)

  let backendFiles: BackendFile[] = [
    { path: "server.mjs", content: BACKEND_SERVER },
    { path: "rbac.mjs", content: "export const SCOPES = ['procurement:create', 'procurement:submit']\n" },
  ]
  let backendSource = "template"
  let backendError = ""
  if (!requirement && ctx.ai.enabled && ctx.ai.provider) {
    const generated = await generateBackendWithAi(ctx, bundle)
    if (generated.ok && generated.files.length > 0) {
      backendFiles = generated.files
      backendSource = "ai"
    } else {
      backendError = generated.error ?? "模型输出未通过契约校验"
    }
  }

  const plans: RolePlan[] = requirement
    ? requirementPlans(requirement, schema, anchors)
    : [
      {
        role: "Database Builder",
        dir: "db",
        files: [
          { path: "schema.sql", content: schema },
          { path: "seed.sql", content: "INSERT INTO inventory_item (sku, name, quantity) VALUES ('SRV-01', '应用服务器', 10);\n" },
        ],
      },
      { role: "Backend Builder", dir: "backend", files: backendFiles },
      {
        role: "Frontend Builder",
        dir: "frontend",
        files: [
          { path: "ProcurementTable.vue", content: FRONTEND_TABLE },
          { path: "anchors.json", content: `${JSON.stringify(anchors, null, 2)}\n` },
        ],
      },
    ]

  const generatedRoot = join(ctx.store.generatedRoot(), "roles")
  const artifacts: Artifact[] = []
  await Promise.all(plans.map(async (plan) => {
    const startedAt = Date.now()
    await ctx.emit("role.run.started", { role: plan.role, stageId: 6, workspace: `generated/roles/${plan.dir}`, contractHash: bundle.hash })
    let bytes = 0
    for (const file of plan.files) {
      const target = join(generatedRoot, plan.dir, file.path)
      await ensureDir(join(target, ".."))
      await writeFile(target, file.content, "utf8")
      bytes += Buffer.byteLength(file.content, "utf8")
    }
    await ctx.emit("role.run.finished", { role: plan.role, status: "succeeded", workspace: `generated/roles/${plan.dir}`, bytes, durationMs: Date.now() - startedAt, budgetUsed: bytes, budgetLimit: 20000, source: plan.role === "Backend Builder" ? backendSource : "template" })
    return { role: plan.role, bytes, files: plan.files.length }
  }))

  const merged: string[] = []
  for (const plan of plans) {
    for (const file of plan.files) {
      const source = await readFile(join(generatedRoot, plan.dir, file.path), "utf8")
      const targetPath = join(ctx.store.generatedRoot(), plan.dir, file.path)
      await ensureDir(join(targetPath, ".."))
      await writeFile(targetPath, source, "utf8")
      merged.push(`${plan.dir}/${file.path}`)
      artifacts.push(await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 6, name: `${plan.dir}-${file.path.replaceAll("/", "-")}`, kind: "code", content: source, producedBy: plan.role }))
    }
  }
  await ctx.emit("role.merge", { mergedFiles: merged, conflicts: [] })
  await ctx.emit("approval.resolved", { stage: 6, kind: "role_execution", subject: "三角色并发写入 generated/", decision: "approved", actor: "operator", hash: bundle.hash, at: new Date().toISOString() })

  return {
    status: "succeeded",
    artifacts,
    notes: [
      `3 个角色并发完成，合并 ${merged.length} 个文件`,
      `契约哈希 ${bundle.hash.slice(0, 12)}`,
      requirement ? `需求包：${requirement.product}` : "内置采购域代码",
      requirement ? "后端代码由需求模板生成" : backendSource === "ai" ? "后端代码由模型生成并通过契约校验" : backendError ? `后端 AI 未通过：${backendError.slice(0, 120)}` : "后端代码使用确定性模板",
    ],
  }
}
