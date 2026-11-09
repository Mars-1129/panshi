import { access, readdir, readFile, stat } from "node:fs/promises"
import { basename, join } from "node:path"
import type { RepoSummary } from "../../shared/types.ts"
import type { Git } from "./git.ts"
import { isMissingFile } from "./fs-utils.ts"

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".cs": "C#",
  ".rb": "Ruby",
  ".php": "PHP",
  ".swift": "Swift",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".hpp": "C++",
  ".md": "Markdown",
  ".sql": "SQL",
}

const ENTRYPOINT_CANDIDATES = [
  "src/index.ts",
  "src/main.ts",
  "src/index.tsx",
  "src/main.tsx",
  "index.js",
  "server.ts",
  "src/main.py",
  "main.py",
  "app.py",
  "cmd/main.go",
  "main.go",
  "src/main.rs",
]

export async function summarizeRepo(root: string, git: Git): Promise<RepoSummary> {
  const files = await listCandidateFiles(root)
  const languages = countLanguages(files)
  const packageManager = await detectPackageManager(root)
  const scripts = await readScripts(root)
  const entrypoints: string[] = []
  for (const candidate of ENTRYPOINT_CANDIDATES) {
    if (await exists(join(root, candidate))) entrypoints.push(candidate)
  }
  const isGit = await git.isRepository(root)
  const baseRevision = isGit ? await git.baseRevision(root).catch(() => undefined) : undefined
  const hasUncommittedChanges = isGit ? await git.hasUncommittedChanges(root) : false
  return {
    root,
    name: basename(root),
    isGit,
    baseRevision,
    languages,
    packageManager,
    scripts,
    entrypoints,
    hasUncommittedChanges,
  }
}

async function listCandidateFiles(root: string): Promise<string[]> {
  const results: string[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (queue.length > 0 && results.length < 2000) {
    const current = queue.shift()
    if (!current) break
    let entries
    try {
      entries = await readdir(current.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".repopilot" || entry.name === ".repo-agent") continue
      if (entry.isDirectory()) {
        if (current.depth < 3) queue.push({ dir: join(current.dir, entry.name), depth: current.depth + 1 })
        continue
      }
      results.push(entry.name)
    }
  }
  return results
}

function countLanguages(files: string[]): string[] {
  const counts = new Map<string, number>()
  for (const file of files) {
    const dot = file.lastIndexOf(".")
    if (dot < 0) continue
    const language = LANGUAGE_BY_EXTENSION[file.slice(dot).toLowerCase()]
    if (!language) continue
    counts.set(language, (counts.get(language) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([language]) => language)
}

async function detectPackageManager(root: string): Promise<string> {
  const candidates: Array<[string, string]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["package-lock.json", "npm"],
    ["uv.lock", "uv"],
    ["poetry.lock", "poetry"],
    ["go.mod", "go"],
    ["Cargo.toml", "cargo"],
    ["pyproject.toml", "python"],
  ]
  for (const [file, name] of candidates) {
    if (await exists(join(root, file))) return name
  }
  return (await exists(join(root, "package.json"))) ? "npm" : "unknown"
}

async function readScripts(root: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(join(root, "package.json"), "utf8")
    const parsed = JSON.parse(raw) as { scripts?: Record<string, unknown> }
    const scripts: Record<string, string> = {}
    for (const [name, value] of Object.entries(parsed.scripts ?? {})) {
      if (typeof value === "string") scripts[name] = value
    }
    return scripts
  } catch (error) {
    if (isMissingFile(error)) return {}
    return {}
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}
