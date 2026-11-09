import { appendFile, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { EventLog } from "../../server/core/event-log.ts"
import type { AgentEvent } from "../../shared/types.ts"

describe("EventLog", () => {
  it("assigns monotonic seq numbers across concurrent appends", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evlog-"))
    const log = new EventLog(join(dir, "events.jsonl"))
    await Promise.all(
      Array.from({ length: 25 }, (_, index) => log.append({ runId: "run_1", taskId: "task_1", type: "system.note", payload: { index } })),
    )
    const events = await log.read(0)
    expect(events).toHaveLength(25)
    expect(events.map((event) => event.seq)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1))
  })

  it("read(after) returns only newer events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evlog-"))
    const log = new EventLog(join(dir, "events.jsonl"))
    for (let index = 0; index < 5; index += 1) {
      await log.append({ runId: "run_1", taskId: "task_1", type: "system.note", payload: { index } })
    }
    const tail = await log.read(3)
    expect(tail.map((event) => event.seq)).toEqual([4, 5])
  })

  it("ignores a torn final line when reloading", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evlog-"))
    const path = join(dir, "events.jsonl")
    const log = new EventLog(path)
    await log.append({ runId: "run_1", taskId: "task_1", type: "system.note", payload: { ok: true } })
    await appendFile(path, '{"seq":2,"runId":"run_1"', "utf8")

    const reloaded = new EventLog(path)
    const events = await reloaded.load()
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe("system.note")

    const appended = await reloaded.append({ runId: "run_1", taskId: "task_1", type: "system.note", payload: {} })
    expect(appended.seq).toBe(2)
  })

  it("notifies subscribers and stops after unsubscribe", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evlog-"))
    const log = new EventLog(join(dir, "events.jsonl"))
    const received: AgentEvent[] = []
    const unsubscribe = log.subscribe((event) => received.push(event))
    await log.append({ runId: "run_1", taskId: "task_1", type: "system.note", payload: {} })
    unsubscribe()
    await log.append({ runId: "run_1", taskId: "task_1", type: "system.note", payload: {} })
    expect(received).toHaveLength(1)
    expect(log.listenerCount()).toBe(0)
  })

  it("keeps going when a listener throws", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evlog-"))
    const log = new EventLog(join(dir, "events.jsonl"))
    log.subscribe(() => {
      throw new Error("subscriber exploded")
    })
    const received: AgentEvent[] = []
    log.subscribe((event) => received.push(event))
    await expect(log.append({ runId: "run_1", taskId: "task_1", type: "system.note", payload: {} })).resolves.toBeDefined()
    expect(received).toHaveLength(1)
  })
})
