import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { PlanCheck } from "../../shared/types.ts"

/**
 * 仓库自定义检查命令。
 *
 * 默认的检查命令从 `package.json` scripts 或 go/cargo/python 推断，
 * 覆盖不到自定义 CI（例如 `make verify`、`./scripts/ci.sh`）。
 * 仓库可以在 `.repopilot/checks.json` 里声明：
 *
 *   {
 *     "checks": [
 *       { "id": "check_lint", "label": "Lint", "command": "make lint", "required": true },
 *       { "id": "check_types", "label": "Types", "command": "tsc --noEmit" }
 *     ]
 *   }
 *
 * 一旦声明，就以它为准——推断逻辑不再参与。这样"业务方说跑什么"和
 * "实际跑什么"之间没有隐藏的转换。
 *
 * 文件缺失或格式不对时返回 null，调用方回落到推断。
 */

export const CUSTOM_CHECKS_PATH = ".repopilot/checks.json"

export type CustomChecksResult =
  | { kind: "none" }
  | { kind: "invalid"; reason: string }
  | { kind: "checks"; checks: PlanCheck[] }

function isPlanCheck(value: unknown, index: number): PlanCheck | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const command = typeof item.command === "string" ? item.command.trim() : ""
  if (!command) return null
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `custom_check_${index + 1}`
  const label = typeof item.label === "string" && item.label.trim() ? item.label.trim() : command
  // required 缺省为 true：显式声明的检查默认必须通过，想放宽要自己写 false
  const required = item.required === false ? false : true
  return { id, label, command, required }
}

export async function readCustomChecks(repoRoot: string): Promise<CustomChecksResult> {
  const path = join(repoRoot, CUSTOM_CHECKS_PATH)
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "none" }
    return { kind: "invalid", reason: `无法读取 ${CUSTOM_CHECKS_PATH}` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: "invalid", reason: `${CUSTOM_CHECKS_PATH} 不是合法 JSON` }
  }

  const list = (parsed as { checks?: unknown } | null)?.checks
  if (!Array.isArray(list)) {
    return { kind: "invalid", reason: `${CUSTOM_CHECKS_PATH} 缺少 checks 数组` }
  }
  if (list.length === 0) {
    // 显式声明"没有检查"是合法的，但不能当成"检查通过"
    return { kind: "invalid", reason: `${CUSTOM_CHECKS_PATH} 的 checks 为空数组` }
  }

  const checks: PlanCheck[] = []
  const seen = new Set<string>()
  for (let index = 0; index < list.length; index += 1) {
    const check = isPlanCheck(list[index], index)
    if (!check) return { kind: "invalid", reason: `${CUSTOM_CHECKS_PATH} 第 ${index + 1} 项缺少 command` }
    if (seen.has(check.id)) return { kind: "invalid", reason: `${CUSTOM_CHECKS_PATH} 的 id 重复：${check.id}` }
    seen.add(check.id)
    checks.push(check)
  }
  return { kind: "checks", checks }
}
