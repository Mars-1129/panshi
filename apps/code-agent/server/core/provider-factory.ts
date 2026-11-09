import type { Config } from "./config.ts"
import { createDemoFakeProvider, HttpProvider, type Provider } from "./provider.ts"

export function createProvider(config: Config): Provider {
  if (config.provider.name === "fake") return createDemoFakeProvider()
  return new HttpProvider({
    name: config.provider.name,
    baseUrl: config.provider.baseUrl,
    model: config.provider.model,
    apiKey: config.provider.apiKey,
  })
}
