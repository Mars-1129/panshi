import { appendFile, readFile } from "node:fs/promises"
import { dirname } from "node:path"
import { AgentEventSchema } from "../../shared/schemas.ts"
import type { AgentEvent, EventType } from "../../shared/types.ts"
import { ensureDir, isMissingFile } from "./fs-utils.ts"

export type EventListener = (event: AgentEvent) => void

export type AppendEventInput = {
  runId: string
  taskId: string
  type: EventType
  payload?: Record<string, unknown>
  time?: string
}

export class EventLog {
  readonly filePath: string
  private seq = 0
  private loaded = false
  private listeners = new Set<EventListener>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async load(): Promise<AgentEvent[]> {
    if (this.loaded) return this.read(0)
    this.loaded = true
    let raw = ""
    try {
      raw = await readFile(this.filePath, "utf8")
    } catch (error) {
      if (isMissingFile(error)) return []
      throw error
    }
    const events: AgentEvent[] = []
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const parsed = AgentEventSchema.parse(JSON.parse(line))
        events.push(parsed)
      } catch {
        // A torn final line from a crash is ignored; the append-only prefix stays valid.
      }
    }
    this.seq = events.reduce((max, event) => Math.max(max, event.seq), 0)
    return events
  }

  async append(input: AppendEventInput): Promise<AgentEvent> {
    return this.enqueue(async () => {
      if (!this.loaded) await this.load()
      this.seq += 1
      const event: AgentEvent = {
        seq: this.seq,
        runId: input.runId,
        taskId: input.taskId,
        time: input.time ?? new Date().toISOString(),
        type: input.type,
        payload: input.payload ?? {},
      }
      await ensureDir(dirname(this.filePath))
      await appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8")
      for (const listener of this.listeners) {
        try {
          listener(event)
        } catch {
          // A broken subscriber must not break the run.
        }
      }
      return event
    })
  }

  async read(afterSeq = 0): Promise<AgentEvent[]> {
    await this.enqueue(async () => undefined)
    let raw = ""
    try {
      raw = await readFile(this.filePath, "utf8")
    } catch (error) {
      if (isMissingFile(error)) return []
      throw error
    }
    const events: AgentEvent[] = []
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const parsed = AgentEventSchema.parse(JSON.parse(line))
        if (parsed.seq > afterSeq) events.push(parsed)
      } catch {
        // Ignore malformed or torn lines.
      }
    }
    return events.sort((left, right) => left.seq - right.seq)
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  listenerCount(): number {
    return this.listeners.size
  }

  close(): void {
    this.listeners.clear()
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task)
    this.queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}
