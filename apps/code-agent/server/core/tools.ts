import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { Limits } from "../../shared/types.ts"
import type { CommandRunner } from "./command-runner.ts"
import { isMissingFile, sha256File, sha256Text, truncateMiddle } from "./fs-utils.ts"
import type { Git } from "./git.ts"
import { PathGuardError, isSensitivePath, normalizeRelativePath, resolveInside } from "./path-guard.ts"

export type ToolContext = {
  worktree: string
  baseRevision: string
  git: Git
  runner: CommandRunner
  limits: Limits
  writesUsed: number
  readOnly?: boolean
  signal?: AbortSignal
}

export type ToolResult = {
  ok: boolean
  tool: string
  output: unknown
  error?: string
}

export type ToolCall = {
  name: string
  arguments: Record<string, unknown>
}

export const TOOL_NAMES = [
  "repo_list",
  "repo_search",
  "repo_read",
  "repo_write",
  "git_status",
  "git_diff",
  "exec",
  "report_findings",
  "finish",
] as const

export async function executeTool(call: ToolCall, context: ToolContext): Promise<ToolResult> {
  try {
    switch (call.name) {
      case "repo_list":
        return ok(call.name, await repoList(call.arguments, context))
      case "repo_search":
        return ok(call.name, await repoSearch(call.arguments, context))
      case "repo_read":
        return ok(call.name, await repoRead(call.arguments, context))
      case "repo_write":
        return ok(call.name, await repoWrite(call.arguments, context))
      case "git_status":
        return ok(call.name, await gitStatus(context))
      case "git_diff":
        return ok(call.name, await gitDiff(call.arguments, context))
      case "exec":
        return ok(call.name, await exec(call.arguments, context))
      case "report_findings":
        return ok(call.name, { reported: true, findings: call.arguments.findings ?? [] })
      case "finish":
        return ok(call.name, { done: true, summary: asString(call.arguments.summary) })
      default:
        return { ok: false, tool: call.name, output: null, error: `Unknown tool: ${call.name}` }
    }
  } catch (error) {
    if (error instanceof PathGuardError) {
      return { ok: false, tool: call.name, output: null, error: `${error.code}: ${error.message}` }
    }
    return { ok: false, tool: call.name, output: null, error: error instanceof Error ? error.message : "Tool failed" }
  }
}

function ok(tool: string, output: unknown): ToolResult {
  return { ok: true, tool, output }
}

async function repoList(args: Record<string, unknown>, context: ToolContext): Promise<unknown> {
  const requested = asString(args.path, "")
  const depth = Math.min(Math.max(asNumber(args.depth, 1), 1), 3)
  const root = requested === "" || requested === "."
    ? context.worktree
    : (await resolveInside(context.worktree, requested)).absolute
  const entries: Array<{ path: string; type: "file" | "directory" }> = []
  const queue: Array<{ dir: string; prefix: string; level: number }> = [{ dir: root, prefix: requested === "" || requested === "." ? "" : `${requested.replace(/\/+$/, "")}/`, level: 0 }]
  let visited = 0
  while (queue.length > 0 && visited < 500) {
    const current = queue.shift()
    if (!current) break
    const items = await readdir(current.dir, { withFileTypes: true })
    for (const item of items) {
      visited += 1
      if (item.name === ".git" || item.name === "node_modules" || item.name === ".repopilot" || item.name === ".repo-agent") continue
      const relativePath = `${current.prefix}${item.name}`
      if (item.isDirectory()) {
        entries.push({ path: relativePath, type: "directory" })
        if (current.level + 1 < depth) queue.push({ dir: join(current.dir, item.name), prefix: `${relativePath}/`, level: current.level + 1 })
      } else {
        entries.push({ path: relativePath, type: "file" })
      }
      if (entries.length >= 500) break
    }
  }
  return { entries, truncated: visited >= 500 }
}

async function repoSearch(args: Record<string, unknown>, context: ToolContext): Promise<unknown> {
  const pattern = asString(args.pattern)
  if (!pattern) throw new Error("repo_search requires a pattern")
  const glob = asString(args.glob, "")
  const result = await context.runner.run({
    command: "rg",
    args: ["--line-number", "--no-heading", "--color", "never", "--max-count", "200", ...(glob ? ["--glob", glob] : []), "--", pattern, "."],
    cwd: context.worktree,
    timeoutMs: 30_000,
    maxOutputBytes: context.limits.maxOutputBytes,
    signal: context.signal,
  })
  if (result.blocked) throw new Error(result.blocked)
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    throw new Error(`Search failed: ${result.stderr.trim() || "ripgrep returned " + String(result.exitCode)}`)
  }
  const matches = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 200)
    .flatMap((line) => {
      const match = /^\.\/(.*?):(\d+):(.*)$/.exec(line)
      if (!match) return []
      // Never return contents of credential-bearing files, even when the pattern matches.
      if (isSensitivePath(match[1])) return []
      return [{ path: match[1], line: Number(match[2]), text: match[3] }]
    })
  return { matches, truncated: result.truncated, note: matches.length === 0 ? "No matches" : undefined }
}

async function repoRead(args: Record<string, unknown>, context: ToolContext): Promise<unknown> {
  const requested = asString(args.path)
  const resolved = await resolveInside(context.worktree, requested)
  const raw = await readFile(resolved.absolute, "utf8")
  const lines = raw.split(/\r?\n/)
  const startLine = Math.max(1, asNumber(args.startLine, 1))
  const endLine = Math.min(lines.length, asNumber(args.endLine, lines.length))
  const slice = lines.slice(startLine - 1, endLine).join("\n")
  const limited = truncateMiddle(slice, context.limits.maxOutputBytes)
  return {
    path: resolved.relativePath,
    content: limited.value,
    startLine,
    endLine,
    totalLines: lines.length,
    truncated: limited.truncated,
  }
}

async function repoWrite(args: Record<string, unknown>, context: ToolContext): Promise<unknown> {
  if (context.readOnly) throw new Error("This mode is read-only; repository writes are disabled")
  const requested = asString(args.path)
  const content = asString(args.content, "")
  if (context.writesUsed >= context.limits.maxWrites) {
    throw new Error(`Write budget exhausted (${context.limits.maxWrites} files)`)
  }
  const resolved = await resolveInside(context.worktree, requested, { forWrite: true })
  const baseHash = asString(args.baseHash, "")
  if (baseHash) {
    let currentHash = ""
    try {
      currentHash = await sha256File(resolved.absolute)
    } catch (error) {
      if (!isMissingFile(error)) throw error
    }
    if (currentHash && currentHash !== baseHash) {
      throw new Error("baseHash mismatch: the file changed since it was read")
    }
  }
  await mkdir(dirname(resolved.absolute), { recursive: true })
  await writeFile(resolved.absolute, content, "utf8")
  context.writesUsed += 1
  return {
    path: resolved.relativePath,
    bytes: Buffer.byteLength(content, "utf8"),
    sha256: sha256Text(content),
  }
}

async function gitStatus(context: ToolContext): Promise<unknown> {
  const result = await context.git.run(context.worktree, ["status", "--porcelain"])
  return { status: result.stdout.trim(), ok: result.ok }
}

async function gitDiff(args: Record<string, unknown>, context: ToolContext): Promise<unknown> {
  const requested = asString(args.path, "")
  if (requested) {
    // Reuse the same guards as repo_read so diffs cannot disclose secrets.
    await resolveInside(context.worktree, requested)
  }
  const diff = requested
    ? await context.git.diffForFile(context.worktree, context.baseRevision, requested, context.limits.maxDiffBytes)
    : await context.git.fullDiff(context.worktree, context.baseRevision, context.limits.maxDiffBytes)
  return { diff }
}

async function exec(args: Record<string, unknown>, context: ToolContext): Promise<unknown> {
  if (context.readOnly) throw new Error("This mode is read-only; command execution is disabled")
  const command = asString(args.command)
  if (!command) throw new Error("exec requires a command")
  const commandArgs = Array.isArray(args.args) ? args.args.filter((value): value is string => typeof value === "string") : []
  const result = await context.runner.run({
    command,
    args: commandArgs,
    cwd: context.worktree,
    timeoutMs: context.limits.commandTimeoutMs,
    maxOutputBytes: context.limits.maxOutputBytes,
    signal: context.signal,
  })
  if (result.blocked) throw new Error(result.blocked)
  return {
    command: result.command,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    truncated: result.truncated,
    blocked: result.blocked,
  }
}

export async function fileInfo(worktree: string, relativePath: string): Promise<{ exists: boolean; bytes: number }> {
  try {
    const info = await stat(join(worktree, normalizeRelativePath(relativePath)))
    return { exists: true, bytes: info.size }
  } catch {
    return { exists: false, bytes: 0 }
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}
