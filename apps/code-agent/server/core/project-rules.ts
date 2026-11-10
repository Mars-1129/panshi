import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * 仓库规则文件。
 *
 * 项目约定（命名风格、目录边界、提交规范、禁止改动的地方）存在于代码里，
 * 但默认不会进入提示词，智能体只能靠猜。这里按固定顺序读取仓库根与
 * 子目录的规则文件，拼成一段可以安全注入系统提示词的内容。
 *
 * 顺序：越靠后的越具体，冲突时以具体为准。
 *   AGENTS.md → .repopilot/rules.md → CLAUDE.md
 *
 * 单文件上限 8KB：规则文件是给人看的，写到这个量级说明该拆了；
 * 超限时截断并明确标注，避免把上下文吃光。
 */

export const RULE_FILES = ["AGENTS.md", ".repopilot/rules.md", "CLAUDE.md"] as const
const MAX_BYTES_PER_FILE = 8 * 1024
const MAX_TOTAL_CHARS = 12_000

export type RuleSource = {
  path: string
  chars: number
  truncated: boolean
}

export type ProjectRules = {
  text: string
  sources: RuleSource[]
}

const EMPTY: ProjectRules = { text: "", sources: [] }

export async function readProjectRules(repoRoot: string, options: { maxTotalChars?: number } = {}): Promise<ProjectRules> {
  const maxTotal = options.maxTotalChars ?? MAX_TOTAL_CHARS
  const sections: string[] = []
  const sources: RuleSource[] = []
  let budget = maxTotal

  for (const relative of RULE_FILES) {
    if (budget <= 0) break
    let raw: string
    try {
      raw = await readFile(join(repoRoot, relative), "utf8")
    } catch {
      continue
    }
    const trimmed = raw.trim()
    if (!trimmed) continue

    let body = trimmed
    let truncated = false
    if (body.length > MAX_BYTES_PER_FILE) {
      body = body.slice(0, MAX_BYTES_PER_FILE)
      truncated = true
    }
    if (body.length > budget) {
      body = body.slice(0, budget)
      truncated = true
    }
    budget -= body.length

    sections.push(`### ${relative}${truncated ? "（已截断）" : ""}\n${body}`)
    sources.push({ path: relative, chars: body.length, truncated })
  }

  if (sections.length === 0) return EMPTY
  return { text: sections.join("\n\n"), sources }
}

/**
 * 把规则拼进系统提示词。没有规则时返回空串，调用方直接跳过这一段，
 * 不留下"规则：（无）"这种噪声。
 */
export function formatRulesForPrompt(rules: ProjectRules): string {
  if (!rules.text) return ""
  return [
    "## 仓库规则（由仓库维护者提供，优先级高于通用习惯）",
    "以下内容来自仓库的规则文件。凡是与本次任务相关的约定，按它执行；",
    "如果它与任务说明直接冲突，以任务说明为准，并在 finish 的说明里指出这处冲突。",
    "",
    rules.text,
  ].join("\n")
}
