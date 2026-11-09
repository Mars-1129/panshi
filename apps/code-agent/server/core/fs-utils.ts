import { createHash } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { z } from "zod"

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

/**
 * Atomic JSON write. On Windows a rename over an open file fails with EPERM/EBUSY
 * (antivirus, an editor, or a concurrent reader), so retry briefly before giving up.
 */
export async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path))
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rename(temporary, path)
      return
    } catch (error) {
      const code = (error as { code?: string }).code
      const retryable = code === "EPERM" || code === "EBUSY" || code === "EACCES" || code === "ENOTEMPTY"
      if (!retryable || attempt === 5) {
        await rm(temporary, { force: true }).catch(() => undefined)
        throw error
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 15 * (attempt + 1)))
    }
  }
}

export async function readJsonFile<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(path, "utf8")
  return schema.parse(JSON.parse(raw))
}

export async function readJsonFileOrNull<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    return await readJsonFile(path, schema)
  } catch (error) {
    if (isMissingFile(error)) return null
    throw error
  }
}

export function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT"
}

export async function sha256File(path: string): Promise<string> {
  const content = await readFile(path)
  return createHash("sha256").update(content).digest("hex")
}

export function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function truncateMiddle(value: string, maxBytes: number): { value: string; truncated: boolean } {
  const buffer = Buffer.from(value, "utf8")
  if (buffer.byteLength <= maxBytes) return { value, truncated: false }
  const half = Math.max(1, Math.floor(maxBytes / 2) - 32)
  const head = buffer.subarray(0, half).toString("utf8")
  const tail = buffer.subarray(buffer.byteLength - half).toString("utf8")
  return {
    value: `${head}\n\n… [${buffer.byteLength - half * 2} bytes truncated] …\n\n${tail}`,
    truncated: true,
  }
}
