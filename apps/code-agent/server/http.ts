import type { IncomingMessage, ServerResponse } from "node:http"
import { z, ZodError } from "zod"
import {
  ApproveTaskInputSchema,
  CreateTaskInputSchema,
  RejectTaskInputSchema,
  SetRepoInputSchema,
  ProjectDraftSchema,
} from "../shared/schemas.ts"
import type { AgentEvent } from "../shared/types.ts"
import type { Runtime } from "./core/runtime.ts"
import { RuntimeError } from "./core/errors.ts"

export type RequestHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>

export type HttpOptions = {
  runtime: Runtime
  bodyLimitBytes?: number
}

const AiConfigInputSchema = z.object({
  provider: z.string().min(1).max(40).optional(),
  baseUrl: z.string().url(),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(8),
})

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/** Local dev server: cap concurrent SSE streams so a runaway client cannot starve the process. */
const MAX_SSE_CONNECTIONS = 32
let openStreams = 0

export function createRequestHandler(options: HttpOptions): RequestHandler {
  const runtime = options.runtime
  const bodyLimitBytes = options.bodyLimitBytes ?? 64 * 1024

  return async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`)
      if (!url.pathname.startsWith("/api/runtime")) {
        sendJson(response, 404, { error: { code: "not_found", message: "Unknown route" } })
        return
      }
      if (!isLocalHost(request.headers.host)) {
        sendJson(response, 403, { error: { code: "forbidden_host", message: "Only localhost hosts are allowed" } })
        return
      }
      if (MUTATING_METHODS.has(request.method ?? "GET")) {
        if (request.headers["x-repopilot-request"] !== "1") {
          sendJson(response, 403, { error: { code: "missing_header", message: "Missing X-RepoPilot-Request header" } })
          return
        }
        if (!isAllowedOrigin(request.headers.origin)) {
          sendJson(response, 403, { error: { code: "forbidden_origin", message: "Origin is not allowed" } })
          return
        }
      }

      if (url.pathname === "/api/runtime/health" && request.method === "GET") {
        sendJson(response, 200, runtime.health())
        return
      }

      if (url.pathname === "/api/runtime/ai") {
        if (request.method === "GET") {
          sendJson(response, 200, runtime.aiStatus())
          return
        }
        if (request.method === "POST") {
          const input = await readJson(request, AiConfigInputSchema, bodyLimitBytes)
          sendJson(response, 200, await runtime.configureAi(input))
          return
        }
        if (request.method === "DELETE") {
          sendJson(response, 200, await runtime.clearAi())
          return
        }
      }

      if (url.pathname === "/api/runtime/repo") {
        if (request.method === "GET") {
          sendJson(response, 200, {
            repo: runtime.health().repo,
            ready: runtime.repoReady(),
            error: runtime.repoFailure(),
            summary: runtime.repoSummary(),
          })
          return
        }
        if (request.method === "POST") {
          const input = await readJson(request, SetRepoInputSchema, bodyLimitBytes)
          await runtime.useRepo(input.path)
          sendJson(response, 200, {
            repo: runtime.health().repo,
            ready: runtime.repoReady(),
            error: runtime.repoFailure(),
            summary: runtime.repoSummary(),
          })
          return
        }
      }

      if (url.pathname === "/api/runtime/projects") {
        if (request.method === "GET") {
          sendJson(response, 200, { projects: await runtime.projects(), root: runtime.config.projectsRoot ?? "" })
          return
        }
        if (request.method === "POST") {
          const input = await readJson(request, ProjectDraftSchema, bodyLimitBytes)
          sendJson(response, 201, await runtime.createProject(input))
          return
        }
      }

      const projectDeleteMatch = /^\/api\/runtime\/projects\/([^/]+)$/.exec(url.pathname)
      if (projectDeleteMatch && request.method === "DELETE") {
        await runtime.deleteProject(decodeURIComponent(projectDeleteMatch[1]))
        sendJson(response, 200, { deleted: true })
        return
      }

      if (url.pathname === "/api/runtime/tasks") {
        if (request.method === "GET") {
          const tasks = runtime.listTasks()
          const enriched = await Promise.all(tasks.map(async (task) => ({ ...task, factory: task.factory ?? await runtime.factoryState(task.id) })))
          sendJson(response, 200, { tasks: enriched })
          return
        }
        if (request.method === "POST") {
          const input = await readJson(request, CreateTaskInputSchema, bodyLimitBytes)
          const task = await runtime.createTask(input)
          sendJson(response, 201, { task })
          return
        }
      }

      const factoryMatch = /^\/api\/runtime\/tasks\/([^/]+)\/(stages|artifacts|contracts)(?:\/([^/]+))?(?:\/(run))?$/.exec(url.pathname)
      if (factoryMatch) {
        const id = decodeURIComponent(factoryMatch[1])
        const area = factoryMatch[2]
        const rest = factoryMatch[3] ? decodeURIComponent(factoryMatch[3]) : undefined
        const isRun = factoryMatch[4] === "run"
        if (area === "stages" && !rest && request.method === "GET") {
          sendJson(response, 200, { stages: await runtime.factoryStages(id) })
          return
        }
        if (area === "stages" && rest === "run-all" && request.method === "POST") {
          const input = await readJson(request, StageRunInputSchema, bodyLimitBytes, true)
          void runtime.runFactoryAll(id, input?.confirm === true).catch(() => undefined)
          sendJson(response, 202, { started: true })
          return
        }
        if (area === "stages" && rest && /^\d+$/.test(rest) && isRun && request.method === "POST") {
          const stage = Number(rest)
          if (!Number.isInteger(stage) || stage < 0 || stage > 9) {
            throw new RuntimeError(400, "invalid_stage", `Unknown stage: ${rest}`)
          }
          const input = await readJson(request, StageRunInputSchema, bodyLimitBytes, true)
          if ((stage === 5 || stage === 6) && input?.confirm !== true) {
            throw new RuntimeError(409, "confirmation_required", "写入型工段需要显式确认")
          }
          void runtime.runFactoryStage(id, stage, input?.confirm === true).catch(() => undefined)
          sendJson(response, 202, { started: true, stage })
          return
        }
        if (area === "artifacts" && !rest && request.method === "GET") {
          sendJson(response, 200, { artifacts: await runtime.factoryArtifacts(id) })
          return
        }
        if (area === "artifacts" && rest && request.method === "GET") {
          const found = await runtime.factoryArtifact(id, rest)
          if (!found) {
            sendJson(response, 404, { error: { code: "not_found", message: "Unknown artifact" } })
            return
          }
          sendJson(response, 200, found)
          return
        }
        if (area === "contracts" && request.method === "GET") {
          sendJson(response, 200, { bundle: await runtime.factoryContracts(id) })
          return
        }
      }

      const match = /^\/api\/runtime\/tasks\/([^/]+)(?:\/(events|approve|reject|cancel|undo|diff|checks|report))?$/.exec(url.pathname)
      if (match) {
        const id = decodeURIComponent(match[1])
        const action = match[2]
        if (!action && request.method === "GET") {
          const task = runtime.getTask(id)
          sendJson(response, 200, { task: { ...task, factory: task.factory ?? await runtime.factoryState(id) } })
          return
        }
        if (action === "events" && request.method === "GET") {
          const cursor = parseCursor(request, url)
          if (url.searchParams.get("json") === "1") {
            sendJson(response, 200, { events: await runtime.events(id, cursor) })
            return
          }
          await streamEvents(request, response, runtime, id, cursor)
          return
        }
        if (action === "diff" && request.method === "GET") {
          sendJson(response, 200, await runtime.diff(id))
          return
        }
        if (action === "checks" && request.method === "GET") {
          sendJson(response, 200, { checks: runtime.getTask(id).checks })
          return
        }
        if (action === "report" && request.method === "GET") {
          sendJson(response, 200, { report: runtime.getTask(id).report ?? null })
          return
        }
        if (action === "approve" && request.method === "POST") {
          const input = await readJson(request, ApproveTaskInputSchema, bodyLimitBytes, true)
          sendJson(response, 202, { task: await runtime.approve(id, input?.planHash) })
          return
        }
        if (action === "reject" && request.method === "POST") {
          const input = await readJson(request, RejectTaskInputSchema, bodyLimitBytes)
          sendJson(response, 200, { task: await runtime.reject(id, input.reason) })
          return
        }
        if (action === "cancel" && request.method === "POST") {
          sendJson(response, 200, { task: await runtime.cancel(id) })
          return
        }
        if (action === "undo" && request.method === "POST") {
          const input = await readJson(request, UndoInputSchema, bodyLimitBytes, true)
          sendJson(response, 200, { task: await runtime.undo(id, input?.checkpointId) })
          return
        }
      }

      sendJson(response, 404, { error: { code: "not_found", message: "Unknown route" } })
    } catch (error) {
      if (response.headersSent) {
        response.end()
        return
      }
      sendError(response, error)
    }
  }
}

const UndoInputSchema = z.object({ checkpointId: z.string().min(1).optional() }).optional()
const StageRunInputSchema = z.object({ confirm: z.boolean().optional() }).optional()

function parseCursor(request: IncomingMessage, url: URL): number {
  const raw = request.headers["last-event-id"] ?? url.searchParams.get("after") ?? "0"
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

async function streamEvents(request: IncomingMessage, response: ServerResponse, runtime: Runtime, id: string, after: number): Promise<void> {
  runtime.getTask(id)
  if (openStreams >= MAX_SSE_CONNECTIONS) {
    sendJson(response, 429, { error: { code: "too_many_streams", message: "Too many open event streams" } })
    return
  }
  openStreams += 1
  response.statusCode = 200
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8")
  response.setHeader("Cache-Control", "no-cache, no-transform")
  response.setHeader("Connection", "keep-alive")
  response.setHeader("X-Accel-Buffering", "no")

  let lastSent = after
  let live = false
  let closed = false
  const pending: AgentEvent[] = []
  const writeEvent = (event: AgentEvent): boolean => {
    if (closed || event.seq <= lastSent) return true
    lastSent = event.seq
    // 背压不关闭流：大事件日志重放时关闭会导致 EventSource 无限重连。
    return response.write(`id: ${event.seq}\ndata: ${JSON.stringify({ type: "event", event })}\n\n`)
  }

  const drain = (): Promise<void> => new Promise((resolvePromise) => {
    const done = (): void => resolvePromise()
    response.once("drain", done)
    response.once("close", done)
  })

  const unsubscribe = runtime.subscribeEvents(id, (event) => {
    if (!live) {
      pending.push(event)
      return
    }
    writeEvent(event)
    if (isTerminalEvent(event)) cleanup()
  })
  const heartbeat = setInterval(() => {
    if (!closed) response.write(": ping\n\n")
  }, 15_000)

  const cleanup = (): void => {
    if (closed) return
    closed = true
    openStreams = Math.max(0, openStreams - 1)
    clearInterval(heartbeat)
    unsubscribe()
    response.end()
  }

  request.on("close", cleanup)
  response.on("close", cleanup)

  response.write(": connected\n\n")
  const history = await runtime.events(id, after)
  for (const event of history) {
    const ok = writeEvent(event)
    if (!ok && !closed) await drain()
  }
  if (!closed) {
    live = true
    const buffered = pending.splice(0)
    for (const event of buffered) writeEvent(event)
  }

  const task = runtime.getTask(id)
  if (isTerminalStatus(task.status)) {
    // A named terminal frame stops the browser from auto-reconnecting a finished run.
    if (!closed) response.write("event: done\ndata: {}\n\n")
    cleanup()
  }
}

function isTerminalEvent(event: AgentEvent): boolean {
  return event.type === "run.succeeded" || event.type === "run.failed" || event.type === "run.cancelled"
}

function isTerminalStatus(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled"
}

async function readJson<T>(request: IncomingMessage, schema: z.ZodType<T>, limitBytes: number, optional = false): Promise<T> {
  const contentType = request.headers["content-type"] ?? ""
  if (!String(contentType).toLowerCase().includes("application/json")) {
    if (optional) return undefined as T
    throw new RuntimeError(415, "unsupported_media_type", "Content-Type must be application/json")
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > limitBytes) throw new RuntimeError(413, "body_too_large", `Request body exceeds ${limitBytes} bytes`)
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString("utf8")
  if (!raw.trim()) {
    if (optional) return undefined as T
    throw new RuntimeError(400, "empty_body", "Request body is required")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new RuntimeError(400, "invalid_json", "Request body is not valid JSON")
  }
  try {
    return schema.parse(parsed)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new RuntimeError(400, "invalid_body", error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "))
    }
    throw error
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.setHeader("Cache-Control", "no-store")
  response.end(JSON.stringify(body))
}

function sendError(response: ServerResponse, error: unknown): void {
  if (error instanceof RuntimeError) {
    sendJson(response, error.status, { error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof ZodError) {
    sendJson(response, 400, { error: { code: "invalid_body", message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : "Internal error"
  sendJson(response, 500, { error: { code: "internal_error", message } })
}

function isLocalHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return true
  const host = hostHeader.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase()
  return host === "127.0.0.1" || host === "localhost" || host === "::1"
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  try {
    const url = new URL(origin)
    return isLocalHost(url.host)
  } catch {
    return false
  }
}
