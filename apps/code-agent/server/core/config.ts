import { resolve } from "node:path"
import type { Limits } from "../../shared/types.ts"

export const APP_VERSION = "0.1.0"

export const DEFAULT_LIMITS: Limits = {
  maxTurns: 12,
  maxWrites: 4,
  maxRepairLoops: 2,
  maxWallMs: 600_000,
  commandTimeoutMs: 120_000,
  maxOutputBytes: 64 * 1024,
  maxDiffBytes: 512 * 1024,
}

export type ProviderConfig = {
  name: string
  baseUrl: string
  model: string
  apiKey: string
  configured: boolean
}

export type Config = {
  provider: ProviderConfig
  repoRoot: string
  projectsRoot?: string
  aiConfigPath?: string
  port: number
  limits: Limits
}

export function resolveProvider(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const name = (env.REPOPILOT_PROVIDER || "siliconflow").trim().toLowerCase()
  const baseUrl = (env.REPOPILOT_BASE_URL || "https://api.siliconflow.cn/v1").replace(/\/+$/, "")
  const model = env.REPOPILOT_MODEL || "deepseek-ai/DeepSeek-V4-Flash"
  const apiKey = (env.REPOPILOT_API_KEY || env.SILICONFLOW_API_KEY || env.OPENAI_API_KEY || "").trim()
  return { name, baseUrl, model, apiKey, configured: name === "fake" || apiKey.length > 0 }
}

export function loadConfig(overrides: { repo?: string; port?: number } = {}): Config {
  const repoRoot = resolve(overrides.repo || process.env.REPOPILOT_REPO || "../../samples/legacy-procurement")
  const projectsRoot = resolve(process.env.REPOPILOT_PROJECTS_DIR || "../../runtime-workspace/projects")
  const aiConfigPath = resolve(process.env.REPOPILOT_AI_CONFIG || "../../runtime-workspace/ai.json")
  const port = overrides.port ?? Number(process.env.REPOPILOT_PORT || 4174)
  return {
    provider: resolveProvider(),
    repoRoot,
    projectsRoot,
    aiConfigPath,
    port,
    limits: DEFAULT_LIMITS,
  }
}

export function parseByteLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}
