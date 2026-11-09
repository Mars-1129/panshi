import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { z } from "zod"

export const AiSettingsSchema = z.object({
  provider: z.string().min(1).max(40),
  baseUrl: z.string().url(),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(8),
  updatedAt: z.string(),
})

export type AiSettings = z.infer<typeof AiSettingsSchema>

/** 用户显式接入的 AI 配置；存本地，不写入仓库，也不回传给前端。 */
export async function loadAiSettings(path: string): Promise<AiSettings | null> {
  try {
    const raw = await readFile(path, "utf8")
    const parsed = AiSettingsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function saveAiSettings(path: string, settings: AiSettings): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, "utf8")
}

export async function clearAiSettings(path: string): Promise<void> {
  await rm(path, { force: true })
}
