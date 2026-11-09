import { mkdir, symlink, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PathGuardError, isInside, isSensitivePath, normalizeRelativePath, resolveInside } from "../../server/core/path-guard.ts"
import { createTempRepo, type TempRepo } from "../helpers/repo.ts"

let repo: TempRepo

beforeEach(async () => {
  repo = await createTempRepo({ files: { "src/a.ts": "export const a = 1\n", ".env": "SECRET=1\n" } })
})

afterEach(async () => {
  await repo.cleanup()
})

describe("normalizeRelativePath", () => {
  it.each([
    ["../escape.ts", "invalid_path"],
    ["a/../../b.ts", "invalid_path"],
    ["/etc/passwd", "absolute_path"],
    ["C:/Windows/win.ini", "absolute_path"],
    ["a\\..\\b.ts", "invalid_path"],
    ["", "invalid_path"],
    ["CON", "invalid_path"],
    ["src/trailing.", "invalid_path"],
    ["src/trailing ", "invalid_path"],
    [".git/config", "forbidden_path"],
  ])("rejects %s with %s", (input, code) => {
    try {
      normalizeRelativePath(input)
      throw new Error("expected rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(PathGuardError)
      expect((error as PathGuardError).code).toBe(code)
    }
  })

  it("accepts and normalizes backslashes", () => {
    expect(normalizeRelativePath("src\\nested\\file.ts")).toBe("src/nested/file.ts")
  })
})

describe("sensitive paths", () => {
  it.each([".env", ".env.local", "id_rsa", "server.pem", "key.p12", ".npmrc", ".git-credentials", "credentials.json"])(
    "flags %s",
    (name) => {
      expect(isSensitivePath(name)).toBe(true)
      expect(isSensitivePath(`nested/${name}`)).toBe(true)
    },
  )

  it("does not flag ordinary sources", () => {
    expect(isSensitivePath("src/index.ts")).toBe(false)
    expect(isSensitivePath("docs/keyboard.md")).toBe(false)
  })
})

describe("resolveInside", () => {
  it("resolves a normal file inside the root", async () => {
    const result = await resolveInside(repo.root, "src/a.ts")
    expect(isInside(repo.root, result.absolute)).toBe(true)
  })

  it("does not treat a sibling prefix directory as inside", () => {
    expect(isInside("/tmp/repo", "/tmp/repo-evil/secret")).toBe(false)
    expect(isInside("/tmp/repo", "/tmp/repo/child")).toBe(true)
  })

  it("rejects sensitive files by default", async () => {
    await expect(resolveInside(repo.root, ".env")).rejects.toMatchObject({ code: "sensitive_path" })
  })

  it("rejects a symlink that points outside the root", async () => {
    const outside = await createTempRepo({ files: { "secret.txt": "nope" } })
    try {
      const linkPath = join(repo.root, "escape-link")
      await symlink(outside.root, linkPath, process.platform === "win32" ? "junction" : "dir")
      await expect(resolveInside(repo.root, "escape-link/secret.txt")).rejects.toBeInstanceOf(PathGuardError)
    } finally {
      await rm(join(repo.root, "escape-link"), { force: true })
      await outside.cleanup()
    }
  })

  it("allows writing a new file under an existing directory", async () => {
    await mkdir(join(repo.root, "src"), { recursive: true })
    await writeFile(join(repo.root, "src", "existing.ts"), "x", "utf8")
    const result = await resolveInside(repo.root, "src/new-file.ts", { forWrite: true })
    expect(result.relativePath).toBe("src/new-file.ts")
  })
})
