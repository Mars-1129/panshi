import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { CommandRunner } from "./command-runner.ts"
import { isMissingFile } from "./fs-utils.ts"

export type GitResult = {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

export type Checkpoint = {
  id: string
  commit: string
  createdAt: string
  message: string
  empty: boolean
}

export type ChangedFile = {
  path: string
  additions: number
  deletions: number
}

const EXCLUDE_ENTRIES = [".repopilot/", ".repo-agent/"]

export class Git {
  private runner: CommandRunner

  constructor(runner: CommandRunner) {
    this.runner = runner
  }

  async run(cwd: string, args: string[]): Promise<GitResult> {
    const result = await this.runner.run({ command: "git", args, cwd, timeoutMs: 60_000, internal: true })
    return {
      ok: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    }
  }

  async isRepository(root: string): Promise<boolean> {
    const result = await this.run(root, ["rev-parse", "--is-inside-work-tree"])
    return result.ok && result.stdout.trim() === "true"
  }

  async assertRepository(root: string): Promise<void> {
    if (!(await this.isRepository(root))) {
      throw new Error(`Target is not a Git repository: ${root}`)
    }
  }

  async baseRevision(root: string): Promise<string> {
    const result = await this.run(root, ["rev-parse", "HEAD"])
    if (!result.ok) throw new Error(`Repository has no readable HEAD: ${result.stderr.trim() || "unknown error"}`)
    return result.stdout.trim()
  }

  async hasUncommittedChanges(root: string): Promise<boolean> {
    const result = await this.run(root, ["status", "--porcelain"])
    return result.ok && result.stdout.trim().length > 0
  }

  async ensureLocalExcludes(root: string): Promise<void> {
    const excludePath = join(root, ".git", "info", "exclude")
    let current = ""
    try {
      current = await readFile(excludePath, "utf8")
    } catch (error) {
      if (!isMissingFile(error)) throw error
      await mkdir(dirname(excludePath), { recursive: true })
      await writeFile(excludePath, "", "utf8")
    }
    const missing = EXCLUDE_ENTRIES.filter((entry) => !current.split(/\r?\n/).includes(entry))
    if (missing.length === 0) return
    const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : ""
    await appendFile(excludePath, `${prefix}${missing.join("\n")}\n`, "utf8")
  }

  worktreePath(repoRoot: string, taskId: string): string {
    return join(repoRoot, ".repopilot", "worktrees", taskId)
  }

  async createWorktree(repoRoot: string, worktreePath: string, branch: string, baseRevision: string): Promise<void> {
    await this.ensureLocalExcludes(repoRoot)
    await mkdir(dirname(worktreePath), { recursive: true })
    const result = await this.run(repoRoot, ["worktree", "add", "-b", branch, worktreePath, baseRevision])
    if (!result.ok) {
      throw new Error(`Failed to create worktree: ${result.stderr.trim() || result.stdout.trim()}`)
    }
  }

  async removeWorktree(repoRoot: string, worktreePath: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await this.run(repoRoot, ["worktree", "remove", "--force", worktreePath])
      if (result.ok) return
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250 * (attempt + 1)))
    }
    await this.run(repoRoot, ["worktree", "prune"])
  }

  async head(worktreePath: string): Promise<string> {
    const result = await this.run(worktreePath, ["rev-parse", "HEAD"])
    if (!result.ok) throw new Error(`Cannot read worktree HEAD: ${result.stderr.trim()}`)
    return result.stdout.trim()
  }

  async checkpoint(worktreePath: string, id: string, message: string): Promise<Checkpoint> {
    await this.run(worktreePath, ["add", "-A"])
    const staged = await this.run(worktreePath, ["diff", "--cached", "--quiet"])
    const empty = staged.ok
    if (!empty) {
      const commit = await this.run(worktreePath, [
        "-c",
        "user.name=RepoPilot",
        "-c",
        "user.email=repopilot@localhost",
        "commit",
        "--no-verify",
        "-m",
        `checkpoint ${id}: ${message}`,
      ])
      if (!commit.ok) throw new Error(`Checkpoint commit failed: ${commit.stderr.trim() || commit.stdout.trim()}`)
    }
    const commit = await this.head(worktreePath)
    return { id, commit, createdAt: new Date().toISOString(), message, empty }
  }

  async resetTo(worktreePath: string, commit: string): Promise<void> {
    const result = await this.run(worktreePath, ["reset", "--hard", commit])
    if (!result.ok) throw new Error(`Undo failed: ${result.stderr.trim()}`)
    await this.run(worktreePath, ["clean", "-fd"])
  }

  async changedFiles(worktreePath: string, baseRevision: string): Promise<ChangedFile[]> {
    const result = await this.run(worktreePath, ["diff", "--numstat", "-z", baseRevision])
    if (!result.ok) return []
    const parts = result.stdout.split("\0")
    const files: ChangedFile[] = []
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]
      if (!part) continue
      const match = /^(\d+|-)\t(\d+|-)\t(.*)$/.exec(part)
      if (!match) continue
      const additions = match[1] === "-" ? 0 : Number(match[1])
      const deletions = match[2] === "-" ? 0 : Number(match[2])
      let path = match[3]
      if (path === "") {
        const oldPath = parts[index + 1] ?? ""
        const newPath = parts[index + 2] ?? ""
        index += 2
        path = newPath || oldPath
      }
      files.push({ path, additions, deletions })
    }
    return files.sort((left, right) => left.path.localeCompare(right.path))
  }

  async nameStatus(worktreePath: string, baseRevision: string): Promise<Map<string, { kind: "added" | "modified" | "deleted"; oldPath?: string }>> {
    const result = await this.run(worktreePath, ["diff", "--name-status", "-z", "--find-renames", baseRevision])
    const statuses = new Map<string, { kind: "added" | "modified" | "deleted"; oldPath?: string }>()
    if (!result.ok) return statuses
    const parts = result.stdout.split("\0")
    for (let index = 0; index < parts.length; index += 1) {
      const status = parts[index]
      if (!status) continue
      if (status.startsWith("R") || status.startsWith("C")) {
        const oldPath = parts[index + 1] ?? ""
        const newPath = parts[index + 2] ?? ""
        index += 2
        if (newPath || oldPath) statuses.set(newPath || oldPath, { kind: "modified", oldPath: oldPath || undefined })
        continue
      }
      const path = parts[index + 1] ?? ""
      index += 1
      if (!path) continue
      if (status.startsWith("A")) statuses.set(path, { kind: "added" })
      else if (status.startsWith("D")) statuses.set(path, { kind: "deleted" })
      else statuses.set(path, { kind: "modified" })
    }
    return statuses
  }

  async diffForFile(worktreePath: string, baseRevision: string, path: string, maxBytes: number, oldPath?: string): Promise<string> {
    const pathspecs = oldPath && oldPath !== path ? [oldPath, path] : [path]
    const result = await this.run(worktreePath, ["diff", "--no-color", "--find-renames", "--unified=3", baseRevision, "--", ...pathspecs])
    if (!result.ok) return ""
    const buffer = Buffer.from(result.stdout, "utf8")
    if (buffer.byteLength <= maxBytes) return result.stdout
    return `${buffer.subarray(0, maxBytes).toString("utf8")}\n… [diff truncated] …\n`
  }

  async fullDiff(worktreePath: string, baseRevision: string, maxBytes: number): Promise<string> {
    const result = await this.run(worktreePath, ["diff", "--no-color", "--unified=3", baseRevision])
    if (!result.ok) return ""
    const buffer = Buffer.from(result.stdout, "utf8")
    if (buffer.byteLength <= maxBytes) return result.stdout
    return `${buffer.subarray(0, maxBytes).toString("utf8")}\n… [diff truncated] …\n`
  }

  async listTrackedFiles(root: string): Promise<string[]> {
    const result = await this.run(root, ["ls-files"])
    if (!result.ok) return []
    return result.stdout.split(/\r?\n/).filter(Boolean)
  }
}
