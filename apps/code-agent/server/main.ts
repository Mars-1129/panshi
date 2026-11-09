import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import { extname, join, resolve } from "node:path"
import { loadConfig } from "./core/config.ts"
import { createProvider } from "./core/provider-factory.ts"
import { Runtime } from "./core/runtime.ts"
import { createRequestHandler } from "./http.ts"
import { isInside } from "./core/path-guard.ts"

loadEnvFiles()

type Args = {
  check: boolean
  port?: number
  repo?: string
  dist?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = { check: false }
  for (const entry of argv) {
    if (entry === "--check") args.check = true
    else if (entry.startsWith("--port=")) args.port = Number(entry.slice("--port=".length))
    else if (entry.startsWith("--repo=")) args.repo = entry.slice("--repo=".length)
    else if (entry.startsWith("--dist=")) args.dist = entry.slice("--dist=".length)
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const config = loadConfig({ repo: args.repo, port: args.port })
const runtime = new Runtime({ config, provider: createProvider(config) })
await runtime.init()

if (args.check) {
  const health = runtime.health()
  const summary = runtime.repoSummary()
  console.log(
    JSON.stringify(
      {
        health,
        summary,
        checks: {
          repoReady: runtime.repoReady(),
          providerConfigured: health.configured,
          node: process.version,
        },
      },
      null,
      2,
    ),
  )
  if (!runtime.repoReady()) process.exit(1)
  if (!health.configured) process.exit(2)
  process.exit(0)
}

const distRoot = resolve(args.dist ?? join(import.meta.dirname, "../dist"))
const apiHandler = createRequestHandler({ runtime })

const server = createServer((request, response) => {
  const url = request.url ?? "/"
  const fail = (error: unknown): void => {
    if (response.headersSent) {
      response.end()
      return
    }
    response.statusCode = 500
    response.end("Internal error")
    console.error(`request error: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (url.startsWith("/api/runtime")) {
    apiHandler(request, response).catch(fail)
    return
  }
  serveStatic(request.url ?? "/", distRoot, response).catch(fail)
})

server.listen(config.port, "127.0.0.1", () => {
  const health = runtime.health()
  console.log(`RepoPilot runtime listening on http://127.0.0.1:${config.port}`)
  console.log(`repo=${health.repo} ready=${health.repoReady} provider=${health.provider} model=${health.model} configured=${health.configured}`)
  if (!health.repoReady) console.error(`repository error: ${health.repoError ?? "unknown"}`)
})

server.on("error", (error) => {
  console.error(`server error: ${error.message}`)
  process.exit(1)
})

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1500).unref()
  })
}

async function serveStatic(pathname: string, root: string, response: import("node:http").ServerResponse): Promise<void> {
  let urlPath: string
  try {
    urlPath = decodeURIComponent(pathname.split("?")[0] ?? "/")
  } catch {
    response.statusCode = 400
    response.end("Bad request")
    return
  }
  if (urlPath.includes("\0")) {
    response.statusCode = 400
    response.end("Bad request")
    return
  }
  let filePath = join(root, urlPath === "/" ? "index.html" : urlPath)
  if (!isInside(root, filePath)) {
    response.statusCode = 403
    response.end("Forbidden")
    return
  }
  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = join(filePath, "index.html")
    const body = await readFile(filePath)
    response.statusCode = 200
    response.setHeader("Content-Type", contentType(filePath))
    response.setHeader("Cache-Control", "no-cache")
    response.end(body)
  } catch {
    try {
      const body = await readFile(join(root, "index.html"))
      response.statusCode = 200
      response.setHeader("Content-Type", "text/html; charset=utf-8")
      response.end(body)
    } catch {
      response.statusCode = 404
      response.end("Not found")
    }
  }
}

function contentType(path: string): string {
  const extension = extname(path).toLowerCase()
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
  }
  return types[extension] ?? "application/octet-stream"
}

function loadEnvFiles(): void {
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../../.env.local"),
    resolve(import.meta.dirname, "../../.env.local"),
    resolve(import.meta.dirname, "../../../.env.local"),
  ]
  for (const candidate of candidates) {
    try {
      process.loadEnvFile(candidate)
    } catch {
      // Missing env files are expected.
    }
  }
}
