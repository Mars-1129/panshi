import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { formatRulesForPrompt, readProjectRules, RULE_FILES } from "../../server/core/project-rules.ts"

async function repoWith(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "project-rules-"))
  for (const [name, content] of Object.entries(files)) {
    const full = join(root, name)
    await mkdir(join(full, ".."), { recursive: true })
    await writeFile(full, content, "utf8")
  }
  return root
}

describe("readProjectRules · 仓库规则文件", () => {
  it("没有规则文件时返回空，不产生提示噪声", async () => {
    const root = await repoWith({})
    const rules = await readProjectRules(root)
    expect(rules.text).toBe("")
    expect(formatRulesForPrompt(rules)).toBe("")
  })

  it("按 AGENTS.md → .repopilot/rules.md → CLAUDE.md 的顺序拼接", async () => {
    const root = await repoWith({
      "AGENTS.md": "第一条：用中文写注释",
      ".repopilot/rules.md": "第二条：不要改 migrations",
      "CLAUDE.md": "第三条：提交信息用中文",
    })
    const rules = await readProjectRules(root)
    expect(rules.sources.map((item) => item.path)).toEqual([...RULE_FILES])
    const first = rules.text.indexOf("第一条")
    const last = rules.text.indexOf("第三条")
    expect(first).toBeGreaterThanOrEqual(0)
    expect(last).toBeGreaterThan(first)
  })

  it("只存在一个文件时也能工作", async () => {
    const root = await repoWith({ "AGENTS.md": "只此一条" })
    const rules = await readProjectRules(root)
    expect(rules.text).toContain("只此一条")
    expect(rules.sources).toHaveLength(1)
  })

  it("空文件被跳过，不占预算", async () => {
    const root = await repoWith({ "AGENTS.md": "   \n\n  ", "CLAUDE.md": "有用内容" })
    const rules = await readProjectRules(root)
    expect(rules.sources.map((item) => item.path)).toEqual(["CLAUDE.md"])
  })

  it("单文件超过 8KB 时截断并标注", async () => {
    const root = await repoWith({ "AGENTS.md": "x".repeat(9000) })
    const rules = await readProjectRules(root)
    expect(rules.sources[0]?.truncated).toBe(true)
    expect(rules.sources[0]?.chars).toBeLessThanOrEqual(8 * 1024)
    expect(rules.text).toContain("已截断")
  })

  it("总预算耗尽后不再读后面的文件", async () => {
    const root = await repoWith({
      "AGENTS.md": "a".repeat(200),
      "CLAUDE.md": "b".repeat(200),
    })
    const rules = await readProjectRules(root, { maxTotalChars: 250 })
    expect(rules.sources.length).toBeGreaterThanOrEqual(1)
    const total = rules.sources.reduce((sum, item) => sum + item.chars, 0)
    expect(total).toBeLessThanOrEqual(250)
  })
})

describe("formatRulesForPrompt · 注入提示词", () => {
  it("带标题和优先级说明，避免与任务说明混淆", async () => {
    const root = await repoWith({ "AGENTS.md": "用 pnpm 不要用 npm" })
    const section = formatRulesForPrompt(await readProjectRules(root))
    expect(section).toContain("仓库规则")
    expect(section).toContain("以任务说明为准")
    expect(section).toContain("用 pnpm 不要用 npm")
  })

  it("空规则返回空串，调用方据此决定不加这一段", async () => {
    const root = await repoWith({})
    expect(formatRulesForPrompt(await readProjectRules(root))).toBe("")
  })
})
