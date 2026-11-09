import type { RailViolation } from "../../../shared/contracts.ts"

export class RailBlocked extends Error {
  readonly railName: string
  readonly violation: RailViolation
  constructor(railName: string, violation: RailViolation) {
    super(violation.reason)
    this.name = "RailBlocked"
    this.railName = railName
    this.violation = violation
  }
}

const SOURCE_ROOTS = ["backend/", "frontend/", "db/"]

/** 角色访问策略：Judge 物理上不能读取实现源码（由工具层执行，不是提示词约定）。 */
export function assertRoleRead(role: string, relativePath: string): void {
  if (role !== "Judge") return
  const normalized = relativePath.replaceAll("\\", "/")
  if (SOURCE_ROOTS.some((prefix) => normalized.startsWith(prefix) || normalized.includes(`/${prefix}`))) {
    throw new RailBlocked("ForbiddenMemoryRail", {
      railName: "ForbiddenMemoryRail",
      role,
      tool: "repo_read",
      file: normalized,
      reason: `Judge 不允许读取实现源码：${normalized}`,
      expected: "只读取契约（openapi.yaml / schema.sql / component_tree.json）与业务规则",
      actual: `尝试读取 ${normalized}`,
      contractHash: "pending",
      recoveryHint: "改用契约与不变量推理；如确需源码，请由 Backend Builder 角色执行",
      severity: "block",
    })
  }
}

export function verifyGeneratedFile(input: {
  role: string
  relativePath: string
  content: string
  openapiRoutes: string[]
  anchors: string[]
  contractHash: string
}): RailViolation[] {
  const violations: RailViolation[] = []
  const path = input.relativePath.replaceAll("\\", "/")

  if (path.startsWith("backend/") && path.endsWith(".mjs")) {
    const routes = [...input.content.matchAll(/["'`](\/api\/[^"'`\s]+)["'`]/g)].map((item) => item[1] ?? "")
    for (const route of new Set(routes)) {
      const normalized = route.replace(/\$\{[^}]+\}/g, "{id}")
      if (!input.openapiRoutes.some((known) => normalized.startsWith(known.split("{")[0] ?? known))) {
        violations.push({
          railName: "ContractVerifyRail",
          role: input.role,
          file: path,
          reason: `路由不在 OpenAPI 契约内：${route}`,
          expected: `契约路由：${input.openapiRoutes.join(", ")}`,
          actual: route,
          contractHash: input.contractHash,
          recoveryHint: "从 openapi.yaml 重新生成路由骨架，不要手写路径",
          severity: "block",
        })
      }
    }
    const writeRoutes = [...input.content.matchAll(/method:\s*["'](POST|PUT|PATCH|DELETE)["'][\s\S]{0,200}?route:\s*["']([^"']+)["']/g)]
    for (const match of writeRoutes) {
      if (!/@require_rbac_permission/.test(input.content)) {
        violations.push({
          railName: "ContractVerifyRail",
          role: input.role,
          file: path,
          reason: "写操作缺少 RBAC 注解",
          expected: "@require_rbac_permission 出现在写路由处理函数上",
          actual: `${match[1]} ${match[2]}`,
          contractHash: input.contractHash,
          recoveryHint: "补 @require_rbac_permission(scope) 后再提交",
          severity: "block",
        })
      }
    }
  }

  if (path.startsWith("frontend/") && /\.(vue|tsx|jsx|html)$/.test(path)) {
    for (const anchor of input.anchors) {
      const marker = `data-panshi-id="${anchor}"`
      const mentioned = input.content.includes(anchor)
      if (mentioned && !input.content.includes(marker)) {
        violations.push({
          railName: "ContractVerifyRail",
          role: input.role,
          file: path,
          reason: `锚点 ${anchor} 未按规范写成 ${marker}`,
          expected: marker,
          actual: "缺少 data-panshi-id 属性",
          contractHash: input.contractHash,
          recoveryHint: "由 component_tree.json 生成组件壳，不要手写锚点",
          severity: "block",
        })
      }
    }
  }
  return violations
}

export function openApiRoutes(openapi: string): string[] {
  return [...openapi.matchAll(/^ {2}(\/api\/[^\s:]+):/gm)].map((item) => item[1] ?? "")
}

export function treeAnchors(tree: string): string[] {
  try {
    const parsed = JSON.parse(tree) as { anchors?: Array<{ id?: string }> }
    return (parsed.anchors ?? []).map((item) => item.id ?? "").filter(Boolean)
  } catch {
    return []
  }
}

export type RouteScope = { method: string; path: string; scope: string | null }

/** 从 openapi.yaml 解析每个路由声明的 RBAC scope（生成器稳定输出，可用轻量扫描）。 */
export function openApiSecuredRoutes(openapi: string): RouteScope[] {
  const routes: RouteScope[] = []
  let path = ""
  let method = ""
  let scope: string | null = null
  const flush = (): void => {
    if (path && method) routes.push({ method: method.toUpperCase(), path, scope })
  }
  for (const line of openapi.split(/\r?\n/)) {
    const pathMatch = line.match(/^ {2}(\/api\/[^\s:]+):\s*$/)
    if (pathMatch) {
      flush()
      path = pathMatch[1] ?? ""
      method = ""
      scope = null
      continue
    }
    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete):\s*$/)
    if (methodMatch) {
      flush()
      method = methodMatch[1] ?? ""
      scope = null
      continue
    }
    const scopeMatch = line.match(/rbac:\s*\[([^\]]+)\]/)
    if (scopeMatch) scope = (scopeMatch[1] ?? "").trim()
  }
  flush()
  return routes
}

/** 从生成的后端代码里解析路由表（method / route / 可选 rbac scope）。 */
export function generatedRoutes(source: string): RouteScope[] {
  const routes: RouteScope[] = []
  for (const match of source.matchAll(/\{\s*method:\s*"(GET|POST|PUT|PATCH|DELETE)",\s*route:\s*"([^"]+)"(?:,\s*rbac:\s*"([^"]+)")?/g)) {
    routes.push({ method: match[1] ?? "", path: match[2] ?? "", scope: match[3] ?? null })
  }
  return routes
}
