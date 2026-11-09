import { createServer, type Server } from "node:http"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { DEFAULT_LIMITS } from "../../server/core/config.ts"
import { FakeProvider } from "../../server/core/provider.ts"
import { Runtime } from "../../server/core/runtime.ts"
import { createRequestHandler } from "../../server/http.ts"
import { createTempRepo, type TempRepo } from "../helpers/repo.ts"

const PLAN = {
  summary: "Fix sum",
  steps: [{ title: "Fix sum", detail: "" }],
  files: [{ path: "sum.mjs", reason: "" }],
  risks: [],
}

const TURNS = [
  { text: "fix", toolCalls: [{ id: "c1", name: "repo_write", arguments: { path: "sum.mjs", content: "export function sum(a, b) {\n  return a + b\n}\n" } }] },
  { text: "done", toolCalls: [{ id: "c2", name: "finish", arguments: {} }] },
]

let repo: TempRepo
let runtime: Runtime
let server: Server
let baseUrl: string

beforeAll(async () => {
  repo = await createTempRepo()
  runtime = new Runtime({
    config: {
      provider: { name: "fake", baseUrl: "", model: "fake", apiKey: "x", configured: true },
      repoRoot: repo.root,
      aiConfigPath: repo.root + "/.ai-test.json",
      port: 0,
      limits: { ...DEFAULT_LIMITS, maxTurns: 4 },
    },
    provider: new FakeProvider({ plan: PLAN, turnsFactory: () => [...TURNS] }),
  })
  await runtime.init()
  const handler = createRequestHandler({ runtime })
  server = createServer((request, response) => {
    void handler(request, response)
  })
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", () => resolvePromise()))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("no port")
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await runtime.waitForAll().catch(() => undefined)
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()))
  await repo.cleanup()
})

function mutation(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${baseUrl}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-RepoPilot-Request": "1", ...headers },
    body: JSON.stringify(body),
  })
}

describe("HTTP transport", () => {
  it("serves health with limits and no secrets", async () => {
    const response = await fetch(`${baseUrl}/api/runtime/health`)
    const body = (await response.json()) as Record<string, unknown>
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, repoReady: true, provider: "fake" })
    expect(JSON.stringify(body)).not.toContain("apiKey")
  })

  it("rejects mutations without the custom header", async () => {
    const response = await fetch(`${baseUrl}/api/runtime/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x", mode: "generate" }),
    })
    expect(response.status).toBe(403)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("missing_header")
  })

  it("rejects a foreign origin", async () => {
    const response = await mutation("/api/runtime/tasks", { title: "x", mode: "generate" }, { Origin: "https://evil.example" })
    expect(response.status).toBe(403)
  })

  it("rejects non-JSON content types", async () => {
    const response = await fetch(`${baseUrl}/api/runtime/tasks`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "X-RepoPilot-Request": "1" },
      body: "title=x",
    })
    expect(response.status).toBe(415)
  })

  it("rejects oversized bodies", async () => {
    const response = await mutation("/api/runtime/tasks", { title: "x".repeat(80_000), mode: "generate" })
    expect(response.status).toBe(413)
  })

  it("rejects invalid bodies with a schema error", async () => {
    const response = await mutation("/api/runtime/tasks", { title: "", mode: "nope" })
    expect(response.status).toBe(400)
  })

  it("runs the full lifecycle over HTTP and streams events", async () => {
    const created = await mutation("/api/runtime/tasks", { title: "Fix sum", summary: "make it pass", mode: "generate" })
    expect(created.status).toBe(201)
    const { task } = (await created.json()) as { task: { id: string; status: string } }
    await runtime.waitForTask(task.id)

    const snapshot = (await (await fetch(`${baseUrl}/api/runtime/tasks/${task.id}`)).json()) as {
      task: { status: string; plan: { hash: string; checks: Array<{ command: string }> } }
    }
    expect(snapshot.task.status).toBe("awaiting_approval")
    expect(snapshot.task.plan.checks[0]?.command).toBe("npm run test")

    // The plan must be visible before approval; approval without the hash still works,
    // but a stale hash must be rejected.
    const stale = await mutation(`/api/runtime/tasks/${task.id}/approve`, { planHash: "stale" })
    expect(stale.status).toBe(409)

    const approved = await mutation(`/api/runtime/tasks/${task.id}/approve`, { planHash: snapshot.task.plan.hash })
    expect(approved.status).toBe(202)
    await runtime.waitForTask(task.id)

    const final = (await (await fetch(`${baseUrl}/api/runtime/tasks/${task.id}`)).json()) as {
      task: { status: string; checks: Array<{ status: string; exitCode: number }> }
    }
    expect(final.task.status).toBe("succeeded")
    expect(final.task.checks[0]).toMatchObject({ status: "passed", exitCode: 0 })

    const eventsResponse = await fetch(`${baseUrl}/api/runtime/tasks/${task.id}/events?json=1&after=0`)
    const events = (await eventsResponse.json()) as { events: Array<{ seq: number; type: string }> }
    expect(events.events.length).toBeGreaterThan(5)
    expect(events.events.map((event) => event.type)).toContain("run.succeeded")
    expect(events.events.map((event) => event.seq)).toEqual([...events.events.map((event) => event.seq)].sort((a, b) => a - b))

    const tail = (await (await fetch(`${baseUrl}/api/runtime/tasks/${task.id}/events?json=1&after=3`)).json()) as {
      events: Array<{ seq: number }>
    }
    expect(tail.events.every((event) => event.seq > 3)).toBe(true)
  })

  it("streams SSE frames with ids and closes on a finished run", async () => {
    const created = await mutation("/api/runtime/tasks", { title: "SSE", summary: "", mode: "generate" })
    const { task } = (await created.json()) as { task: { id: string } }
    await runtime.waitForTask(task.id)
    const plan = runtime.getTask(task.id).plan
    await mutation(`/api/runtime/tasks/${task.id}/approve`, { planHash: plan?.hash })
    await runtime.waitForTask(task.id)

    const response = await fetch(`${baseUrl}/api/runtime/tasks/${task.id}/events?after=0`)
    const text = await response.text()
    expect(text).toContain("id: 1")
    expect(text).toContain("event: done")
    expect(text).toContain("run.succeeded")
  })

  it("returns 404 for unknown tasks", async () => {
    const response = await fetch(`${baseUrl}/api/runtime/tasks/task_missing`)
    expect(response.status).toBe(404)
  })

  it("does not create a runnable task when the provider is unconfigured", async () => {
    const blocked = new Runtime({
      config: {
        provider: { name: "siliconflow", baseUrl: "http://localhost:1", model: "x", apiKey: "", configured: false },
        repoRoot: repo.root,
        aiConfigPath: repo.root + "/.ai-test.json",
        port: 0,
        limits: DEFAULT_LIMITS,
      },
      provider: new FakeProvider({ plan: PLAN }),
    })
    await blocked.init()
    const temporary = createServer((request, response) => {
      void createRequestHandler({ runtime: blocked })(request, response)
    })
    await new Promise<void>((resolvePromise) => temporary.listen(0, "127.0.0.1", () => resolvePromise()))
    const address = temporary.address()
    if (!address || typeof address === "string") throw new Error("no port")
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/runtime/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-RepoPilot-Request": "1" },
        body: JSON.stringify({ title: "blocked", mode: "generate" }),
      })
      expect(response.status).toBe(201)
      const body = (await response.json()) as { task: { status: string; error: { code: string } } }
      expect(body.task.status).toBe("blocked")
      expect(body.task.error.code).toBe("provider_unconfigured")
    } finally {
      await new Promise<void>((resolvePromise) => temporary.close(() => resolvePromise()))
    }
  })
})
