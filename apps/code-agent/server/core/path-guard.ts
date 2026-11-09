import { lstat, realpath } from "node:fs/promises"
import { isAbsolute, join, relative } from "node:path"

import { isMissingFile } from "./fs-utils.ts"

export class PathGuardError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "PathGuardError"
    this.code = code
  }
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

const SENSITIVE_PATTERNS: RegExp[] = [
  /^\.env(\..*)?$/i,
  /^\.npmrc$/i,
  /^\.git-credentials$/i,
  /^\.netrc$/i,
  /^id_(rsa|ed25519|ecdsa|dsa)(\.pub)?$/i,
  /\.(pem|key|p12|pfx|keystore|jks)$/i,
  /^credentials(\..*)?$/i,
  /^secrets?(\..*)?$/i,
]

export function normalizeRelativePath(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new PathGuardError("invalid_path", "Path must be a non-empty string")
  }
  if (input.includes("\0")) {
    throw new PathGuardError("invalid_path", "Path contains a null byte")
  }
  const slashed = input.replaceAll("\\", "/")
  if (slashed.startsWith("/")) {
    throw new PathGuardError("absolute_path", "Absolute paths are not allowed")
  }
  if (/^[A-Za-z]:/.test(slashed)) {
    throw new PathGuardError("absolute_path", "Drive-letter paths are not allowed")
  }
  const segments = slashed.split("/")
  const normalized: string[] = []
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new PathGuardError("invalid_path", `Path segment is not allowed: ${JSON.stringify(segment)}`)
    }
    if (segment.endsWith(".") || segment.endsWith(" ")) {
      throw new PathGuardError("invalid_path", "Windows strips trailing dots and spaces; refusing this path")
    }
    if (WINDOWS_RESERVED.test(segment)) {
      throw new PathGuardError("invalid_path", `Reserved Windows device name: ${segment}`)
    }
    // `:` opens alternate data streams (`file.txt::$DATA`) and drive-relative forms.
    if (segment.includes(":")) {
      throw new PathGuardError("invalid_path", "Path segments may not contain ':'")
    }
    // NTFS 8.3 aliases (CREDEN~1.JSO) resolve to long names; refuse them.
    if (/~\d+(\.[^.]*)?$/.test(segment)) {
      throw new PathGuardError("invalid_path", "Short (8.3) file names are not allowed")
    }
    // Filesystems here are case-insensitive; compare lowercased.
    if (segment.toLowerCase() === ".git") {
      throw new PathGuardError("forbidden_path", "Git metadata cannot be accessed as a repository file")
    }
    normalized.push(segment)
  }
  return normalized.join("/")
}

export function isSensitivePath(relativePath: string): boolean {
  const base = relativePath.replaceAll("\\", "/").split("/").pop() ?? relativePath
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(base))
}

export function isInside(root: string, target: string): boolean {
  const rootValue = process.platform === "win32" ? root.toLowerCase() : root
  const targetValue = process.platform === "win32" ? target.toLowerCase() : target
  const rel = relative(rootValue, targetValue)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

export async function resolveInside(
  root: string,
  requested: string,
  options: { forWrite?: boolean; allowSensitive?: boolean } = {},
): Promise<{ absolute: string; relativePath: string }> {
  const relativePath = normalizeRelativePath(requested)
  if (!options.allowSensitive && isSensitivePath(relativePath)) {
    throw new PathGuardError("sensitive_path", `Refusing to access sensitive file: ${relativePath}`)
  }

  let rootReal: string
  try {
    rootReal = await realpath(root)
  } catch (error) {
    if (isMissingFile(error)) throw new PathGuardError("missing_root", `Repository root does not exist: ${root}`)
    throw error
  }

  const absolute = join(rootReal, ...relativePath.split("/"))
  if (options.forWrite) {
    // A symlink at the write target (even a dangling one) would redirect the write.
    try {
      const info = await lstat(absolute)
      if (info.isSymbolicLink()) {
        throw new PathGuardError("forbidden_path", `Refusing to write through a symlink: ${relativePath}`)
      }
    } catch (error) {
      if (error instanceof PathGuardError) throw error
      if (!isMissingFile(error)) throw error
    }
  }
  const resolved = await resolveExistingAncestor(absolute, options.forWrite === true)
  if (!isInside(rootReal, resolved)) {
    throw new PathGuardError("escape", `Path escapes the repository root: ${relativePath}`)
  }
  // Check the canonical path too, so a symlink cannot smuggle a sensitive file in.
  const canonicalRelative = relative(rootReal, resolved).replaceAll("\\", "/")
  if (!options.allowSensitive && canonicalRelative && isSensitivePath(canonicalRelative)) {
    throw new PathGuardError("sensitive_path", `Refusing to access sensitive file: ${canonicalRelative}`)
  }
  return { absolute, relativePath }
}

async function resolveExistingAncestor(absolute: string, forWrite: boolean): Promise<string> {
  if (!forWrite) {
    return realpath(absolute)
  }
  try {
    return await realpath(absolute)
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }
  let current = absolute
  for (let index = 0; index < 64; index += 1) {
    const parent = current.replace(/[\\/][^\\/]+$/, "")
    if (!parent || parent === current) break
    current = parent
    try {
      return await realpath(current)
    } catch (error) {
      if (!isMissingFile(error)) throw error
    }
  }
  throw new PathGuardError("missing_root", "No existing ancestor could be resolved for the write target")
}
