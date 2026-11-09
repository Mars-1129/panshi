import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export type TempRepo = {
  root: string
  cleanup: () => Promise<void>
}

export async function createTempRepo(options: { files?: Record<string, string>; commit?: boolean } = {}): Promise<TempRepo> {
  const root = await mkdtemp(join(tmpdir(), "repopilot-test-"))
  const files = options.files ?? defaultFiles()
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path)
    await mkdir(join(target, ".."), { recursive: true })
    await writeFile(target, content, "utf8")
  }
  git(root, ["init", "-q"])
  git(root, ["config", "user.name", "Test"])
  git(root, ["config", "user.email", "test@localhost"])
  git(root, ["config", "commit.gpgsign", "false"])
  if (options.commit !== false) {
    git(root, ["add", "-A"])
    git(root, ["commit", "-q", "--no-verify", "-m", "init"])
  }
  return {
    root,
    cleanup: async () => {
      const { rm } = await import("node:fs/promises")
      await rm(root, { recursive: true, force: true, maxRetries: 5 })
    },
  }
}

export function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true })
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`)
  return result.stdout
}

function defaultFiles(): Record<string, string> {
  return {
    "package.json": `${JSON.stringify({ name: "fixture", version: "1.0.0", scripts: { test: "node test.mjs" } }, null, 2)}\n`,
    "sum.mjs": "export function sum(a, b) {\n  return a - b\n}\n",
    "test.mjs": [
      'import assert from "node:assert/strict"',
      'import { sum } from "./sum.mjs"',
      "assert.equal(sum(2, 3), 5)",
      'console.log("ok")',
      "",
    ].join("\n"),
  }
}
