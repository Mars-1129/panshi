import { createHash } from "node:crypto"
import { readFile, readdir, stat } from "node:fs/promises"
import { join, relative, sep } from "node:path"

const IGNORED = new Set([".git", "node_modules", ".repo-agent", ".repopilot", "dist", "build", ".next", "coverage", ".venv", "__pycache__"])

export type WalkedFile = { path: string; absolute: string; bytes: number }

/** 只读遍历仓库文件（跳过依赖、运行记录与 VCS 目录）。 */
export async function walkFiles(root: string, options: { maxFiles?: number; maxBytes?: number } = {}): Promise<WalkedFile[]> {
  const maxFiles = options.maxFiles ?? 2000
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024
  const out: WalkedFile[] = []
  const queue = [root]
  while (queue.length > 0 && out.length < maxFiles) {
    const current = queue.shift()
    if (!current) break
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue
      const absolute = join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(absolute)
        continue
      }
      if (!entry.isFile()) continue
      let size = 0
      try {
        size = (await stat(absolute)).size
      } catch {
        continue
      }
      if (size > maxBytes) continue
      out.push({ path: relative(root, absolute).split(sep).join("/"), absolute, bytes: size })
      if (out.length >= maxFiles) break
    }
  }
  return out.sort((left, right) => left.path.localeCompare(right.path))
}

export async function hashFile(absolute: string): Promise<string> {
  const content = await readFile(absolute)
  return createHash("sha256").update(content).digest("hex")
}
