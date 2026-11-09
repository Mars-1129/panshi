import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { checkCommandPolicy } from "../../server/core/command-runner.ts"
import { PathGuardError, normalizeRelativePath, resolveInside } from "../../server/core/path-guard.ts"
import { parseUnifiedDiff } from "../../src/lib/view-model.ts"
import { createTempRepo } from "../helpers/repo.ts"

describe("command policy regressions", () => {
  it.each([
    [["git", "-c", "alias.pwn=!echo hi", "pwn"]],
    [["git", "reset", "--hard"]],
    [["git", "clean", "-fd"]],
    [["git", "submodule", "update"]],
    [["npm", "ci"]],
    [["pnpm", "dlx", "pkg"]],
    [["npx", "--yes", "pkg"]],
    [["yarn", "exec", "cmd"]],
    [["rg", "--pre", "calc.exe", "x"]],
  ])("blocks %j", (args) => {
    expect(checkCommandPolicy(args[0] as string, args.slice(1) as string[])).not.toBeNull()
  })

  it("still allows normal test and inspection commands", () => {
    expect(checkCommandPolicy("npm", ["run", "test"])).toBeNull()
    expect(checkCommandPolicy("git", ["status", "--porcelain"])).toBeNull()
    expect(checkCommandPolicy("rg", ["--line-number", "foo", "."])).toBeNull()
    expect(checkCommandPolicy("git", ["log", "--oneline"])).toBeNull()
  })
})

describe("path guard regressions", () => {
  it.each([".GIT/config", ".Git/config", ".git/HEAD"])("rejects case variants %s", (input) => {
    expect(() => normalizeRelativePath(input)).toThrow(PathGuardError)
  })

  it("rejects case variants of sensitive names after resolution", async () => {
    const repo = await createTempRepo({ files: { ".env": "SECRET=1" } })
    try {
      await expect(resolveInside(repo.root, ".ENV")).rejects.toMatchObject({ code: "sensitive_path" })
    } finally {
      await repo.cleanup()
    }
  })

  it.each(["file.txt::$DATA", ".env::$DATA", "CREDEN~1.JSO", "SERVER~1.PEM"])("rejects stream/short names %s", (input) => {
    expect(() => normalizeRelativePath(input)).toThrow(PathGuardError)
  })

  it("refuses to write through a symlinked directory that leaves the root", async () => {
    const repo = await createTempRepo({ files: { "a.txt": "hi" } })
    const outside = await createTempRepo({ files: { "victim.txt": "x" } })
    try {
      // Directory junctions are usable on Windows without developer mode; file
      // symlinks are not, so the escape is exercised at the directory level.
      await symlink(outside.root, join(repo.root, "escape"), process.platform === "win32" ? "junction" : "dir")
      await expect(resolveInside(repo.root, "escape", { forWrite: true })).rejects.toMatchObject({ code: "forbidden_path" })
      await expect(resolveInside(repo.root, "escape/new.txt", { forWrite: true })).rejects.toBeInstanceOf(PathGuardError)
    } finally {
      await repo.cleanup()
      await outside.cleanup()
    }
  })
})

describe("diff parsing regressions", () => {
  it("treats content lines starting with '-- ' as removals inside a hunk", () => {
    const diff = [
      "diff --git a/q.sql b/q.sql",
      "--- a/q.sql",
      "+++ b/q.sql",
      "@@ -1,3 +1,3 @@",
      "--- old comment",
      "++ note",
      " select 1;",
    ].join("\n")
    const lines = parseUnifiedDiff(diff)
    const removed = lines.find((line) => line.kind === "remove")
    const added = lines.find((line) => line.kind === "add")
    expect(removed?.text).toBe("-- old comment")
    expect(removed?.oldLine).toBe(1)
    expect(added?.text).toBe("+ note")
    expect(added?.newLine).toBe(1)
    // file header lines + the hunk header
    expect(lines.filter((line) => line.kind === "header")).toHaveLength(4)
  })

  it("resets header detection for a second file", () => {
    const diff = ["diff --git a/a b/a", "@@ -1 +1 @@", "-x", "+y", "diff --git a/b b/b", "--- a/b", "+++ b/b", "@@ -1 +1 @@", "-p", "+q"].join("\n")
    const lines = parseUnifiedDiff(diff)
    expect(lines.filter((line) => line.kind === "remove").map((line) => line.text)).toEqual(["x", "p"])
  })
})
