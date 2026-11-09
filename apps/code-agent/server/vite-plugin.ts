import type { Plugin } from "vite"
import { loadConfig } from "./core/config.ts"
import { createProvider } from "./core/provider-factory.ts"
import { Runtime } from "./core/runtime.ts"
import { createRequestHandler } from "./http.ts"

export function runtimePlugin(options: { runtime?: Runtime } = {}): Plugin {
  let runtime = options.runtime ?? null
  return {
    name: "repopilot-runtime",
    async configureServer(server) {
      if (!runtime) {
        const config = loadConfig()
        runtime = new Runtime({ config, provider: createProvider(config) })
        await runtime.init()
      }
      const activeRuntime = runtime
      const handler = createRequestHandler({ runtime: activeRuntime })
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/api/runtime")) {
          next()
          return
        }
        void handler(request, response)
      })
    },
  }
}
