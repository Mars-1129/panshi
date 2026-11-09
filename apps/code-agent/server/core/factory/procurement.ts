import { createHash } from "node:crypto"
import type { ContractBundle, ContractKind } from "../../../shared/contracts.ts"

export const ANCHORS = [
  "procurement.table",
  "procurement.create",
  "procurement.invoice_verify",
  "procurement.submit",
  "approval.timeline",
  "inventory.summary",
  "budget.dashboard",
] as const

export function buildSchemaSql(): string {
  return `-- schema.sql · PanShi-SwarmFactory MVP
-- 政企采购审批与固定资产管理（PostgreSQL 方言）
CREATE TABLE app_user (
  id            BIGSERIAL PRIMARY KEY,
  employee_no   VARCHAR(32) NOT NULL UNIQUE,
  display_name  VARCHAR(64) NOT NULL,
  role_code     VARCHAR(32) NOT NULL,
  department    VARCHAR(64) NOT NULL
);

CREATE TABLE procurement_order (
  id            BIGSERIAL PRIMARY KEY,
  order_no      VARCHAR(32) NOT NULL UNIQUE,
  title         VARCHAR(200) NOT NULL,
  amount_cents  BIGINT NOT NULL CHECK (amount_cents >= 0),
  status        VARCHAR(24) NOT NULL DEFAULT 'draft',
  applicant_id  BIGINT NOT NULL REFERENCES app_user(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approval_record (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES procurement_order(id),
  step          SMALLINT NOT NULL,
  approver_role VARCHAR(32) NOT NULL,
  decision      VARCHAR(16) NOT NULL,
  decided_at    TIMESTAMPTZ
);

CREATE TABLE inventory_item (
  id            BIGSERIAL PRIMARY KEY,
  sku           VARCHAR(32) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity >= 0),
  version       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE budget_plan (
  id            BIGSERIAL PRIMARY KEY,
  year          SMALLINT NOT NULL,
  department    VARCHAR(64) NOT NULL,
  limit_cents   BIGINT NOT NULL CHECK (limit_cents >= 0),
  used_cents    BIGINT NOT NULL DEFAULT 0
);
`
}

export function buildOpenApi(): string {
  return `openapi: 3.0.3
info:
  title: PanShi Procurement API (MVP)
  version: 1.0.0
paths:
  /api/procurement/orders:
    get:
      operationId: listProcurementOrders
      responses:
        "200":
          description: ok
    post:
      operationId: createProcurementOrder
      security:
        - rbac: [procurement:create]
      responses:
        "201":
          description: created
  /api/procurement/orders/{id}/approve:
    post:
      operationId: submitProcurementApproval
      security:
        - rbac: [procurement:submit]
      responses:
        "202":
          description: accepted
  /api/inventory/summary:
    get:
      operationId: getInventorySummary
      responses:
        "200":
          description: ok
  /api/budget/dashboard:
    get:
      operationId: getBudgetDashboard
      responses:
        "200":
          description: ok
components:
  securitySchemes:
    rbac:
      type: apiKey
      in: header
      name: X-RBAC-Role
`
}

export function buildComponentTree(): string {
  const tree = {
    version: 1,
    product: "政府采购与固定资产管理",
    anchors: ANCHORS.map((id, index) => ({
      id,
      route: id.startsWith("procurement") ? "/procurement" : id.startsWith("approval") ? "/approval" : id.startsWith("inventory") ? "/inventory" : "/budget",
      rbac: `${id.split(".")[0]}:${id.split(".")[1]}`,
      file: ["src/views/ProcurementTable.vue", "src/views/ProcurementForm.vue", "src/views/InvoiceVerify.vue", "src/views/ProcurementSubmit.vue", "src/views/ApprovalTimeline.vue", "src/views/InventorySummary.vue", "src/views/BudgetDashboard.vue"][index],
    })),
  }
  return `${JSON.stringify(tree, null, 2)}\n`
}

export function buildContracts(): Record<ContractKind, string> {
  return { "schema.sql": buildSchemaSql(), "openapi.yaml": buildOpenApi(), "component_tree.json": buildComponentTree() }
}

export function hashContracts(contents: Record<string, string>): string {
  const sorted = Object.keys(contents).sort()
  const hash = createHash("sha256")
  for (const key of sorted) hash.update(key).update("\0").update(contents[key] ?? "")
  return hash.digest("hex").slice(0, 32)
}

export function validateContracts(contents: Record<string, string>): ContractBundle["validation"] {
  const sql = contents["schema.sql"] ?? ""
  const openapi = contents["openapi.yaml"] ?? ""
  const tree = contents["component_tree.json"] ?? ""

  const sqlErrors: string[] = []
  for (const table of ["app_user", "procurement_order", "approval_record", "inventory_item", "budget_plan"]) {
    if (!new RegExp(`CREATE TABLE\\s+${table}\\b`, "i").test(sql)) sqlErrors.push(`缺少表 ${table}`)
  }
  if ((sql.match(/\(/g) ?? []).length !== (sql.match(/\)/g) ?? []).length) sqlErrors.push("括号不配对")
  if (/DROP\s+DATABASE/i.test(sql)) sqlErrors.push("禁止 DROP DATABASE")

  const openapiErrors: string[] = []
  if (!/^openapi:\s*3\./m.test(openapi)) openapiErrors.push("缺少 openapi 3.x 版本声明")
  for (const route of ["/api/procurement/orders", "/api/procurement/orders/{id}/approve", "/api/inventory/summary", "/api/budget/dashboard"]) {
    if (!openapi.includes(route)) openapiErrors.push(`缺少路由 ${route}`)
  }
  if (!/rbac:/.test(openapi)) openapiErrors.push("写操作缺少 RBAC 声明")

  const treeErrors: string[] = []
  try {
    const parsed = JSON.parse(tree) as { anchors?: Array<{ id?: string; route?: string; rbac?: string; file?: string }> }
    const anchors = parsed.anchors ?? []
    for (const id of ANCHORS) {
      if (!anchors.some((item) => item.id === id)) treeErrors.push(`缺少锚点 ${id}`)
    }
    for (const anchor of anchors) {
      if (!anchor.route || !anchor.rbac || !anchor.file) treeErrors.push(`锚点 ${anchor.id ?? "?"} 字段不完整`)
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
