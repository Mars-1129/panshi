import { createHash, randomUUID } from "node:crypto"

export function newTaskId(): string {
  return `task_${randomUUID().replaceAll("-", "").slice(0, 12)}`
}

export function newRunId(): string {
  return `run_${randomUUID().replaceAll("-", "").slice(0, 12)}`
}

export function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

export function safeFileStem(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "") || "item"
}
