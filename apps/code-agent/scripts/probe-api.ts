import { readFileSync } from "node:fs"
import { loadConfig } from "../server/core/config.ts"
import { createProvider } from "../server/core/provider-factory.ts"

if (!process.env.SILICONFLOW_API_KEY && !process.env.REPOPILOT_API_KEY) {
  try {
    const key = readFileSync("../../API.txt", "utf8").trim()
    if (key) process.env.SILICONFLOW_API_KEY = key
  } catch {
    // no key file
  }
}

const config = loadConfig()
console.log("provider:", config.provider.name, "| model:", config.provider.model, "| configured:", config.provider.configured, "| base:", config.provider.baseUrl)
if (!config.provider.configured) {
  console.log("no api key configured")
  process.exit(0)
}

const provider = createProvider(config)
const started = Date.now()
const timeout = new Promise<{ timeout: true }>((resolve) => setTimeout(() => resolve({ timeout: true }), 30_000))
try {
  const result = await Promise.race([
    provider.chat({ system: "", messages: [{ role: "user", content: "只回复两个字：可用" }], tools: [] }),
    timeout,
  ])
  const elapsed = Date.now() - started
  if (result && (result as { timeout?: boolean }).timeout) {
    console.log(`chat: TIMEOUT after ${elapsed}ms`)
  } else {
    console.log(`chat: OK in ${elapsed}ms ->`, JSON.stringify(result).slice(0, 160))
  }
} catch (error) {
  console.log(`chat: FAIL in ${Date.now() - started}ms ->`, String(error).slice(0, 240))
}
