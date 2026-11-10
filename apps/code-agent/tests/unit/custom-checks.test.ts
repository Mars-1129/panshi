import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { CUSTOM_CHECKS_PATH, readCustomChecks } from "../../server/core/custom-checks.ts"

async function repoWith(content: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "custom-checks-"))
  await mkdir(join(root, ".repopilot"), { recursive: true })
  await writeFile(join(root, CUSTOM_CHECKS_PATH), content, "utf8")
  return root
}

describe("readCustomChecks · 仓库自定义检查命令", () => {
  it("没有配置文件时返回 none，调用方回落到推断", async () => {
    const root = await mkdtemp(join(tmpdir(), "cc-none-"))
    expect((await readCustomChecks(root)).kind).toBe("none")
  })

  it("读取合法的 checks 数组", async () => {
    const root = await repoWith(
      JSON.stringify({
        checks: [
          { id: "check_lint", label: "Lint", command: "make lint", required: true },
          { id: "check_types", label: "Types", command: "tsc --noEmit" },
        ],
      }),
    )
    const result = await readCustomChecks(root)
    expect(result.kind).toBe("checks")
    if (result.kind === "checks") {
      expect(result.checks).toHaveLength(2)
      expect(result.checks[0]?.command).toBe("make lint")
      // required 缺省是 true：显式声明的检查默认必须通过
      expect(result.checks[1]?.required).toBe(true)
    }
  })

  it("required:false 可以被显式放宽", async () => {
    const root = await repoWith(
      JSON.stringify({ checks: [{ id: "c1", label: "可选", command: "echo ok", required: false }] }),
    )
    const result = await readCustomChecks(root)
    expect(result.kind).toBe("checks")
    if (result.kind === "checks") expect(result.checks[0]?.required).toBe(false)
  })

  it("缺 id/label 时用兜底值，不缺 command 就可用", async () => {
    const root = await repoWith(JSON.stringify({ checks: [{ command: "npm run verify" }] }))
    const result = await readCustomChecks(root)
    expect(result.kind).toBe("checks")
    if (result.kind === "checks") {
      expect(result.checks[0]?.id).toBe("custom_check_1")
      expect(result.checks[0]?.label).toBe("npm run verify")
    }
  })

  it("非法 JSON 时返回 invalid，而不是静默回落到推断", async () => {
    const root = await repoWith("{ not json")
    const result = await readCustomChecks(root)
    expect(result.kind).toBe("invalid")
    if (result.kind === "invalid") expect(result.reason).toContain("JSON")
  })

  it("缺 checks 数组时返回 invalid", async () => {
    const root = await repoWith(JSON.stringify({ other: [] }))
    expect((await readCustomChecks(root)).kind).toBe("invalid")
  })

  it("空数组不算合法配置（会把交付判定放空）", async () => {
    const root = await repoWith(JSON.stringify({ checks: [] }))
    expect((await readCustomChecks(root)).kind).toBe("invalid")
  })

  it("某一项缺 command 时整体 invalid，避免半套检查被执行", async () => {
    const root = await repoWith(
      JSON.stringify({ checks: [{ id: "ok", command: "echo 1" }, { id: "bad", label: "缺命令" }] }),
    )
    const result = await readCustomChecks(root)
    expect(result.kind).toBe("invalid")
  })

  it("id 重复时 invalid", async () => {
    const root = await repoWith(
      JSON.stringify({ checks: [{ id: "dup", command: "a" }, { id: "dup", command: "b" }] }),
    )
    expect((await readCustomChecks(root)).kind).toBe("invalid")
  })
})
