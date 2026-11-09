import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { CheckSchema, TaskSchema } from "../../shared/schemas.ts"
import type { Check, Plan, Task } from "../../shared/types.ts"
import { EventLog } from "./event-log.ts"
import { atomicWriteJson, ensureDir, isMissingFile, readJsonFileOrNull } from "./fs-utils.ts"

export type TaskRecord = {
  task: Task
  log: EventLog
  mutex: Mutex
}

export class Mutex {
  private tail: Promise<unknown> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task)
    this.tail = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}

const TERMINAL: Task["status"][] = ["succeeded", "failed", "cancelled"]

const ACTIVE_DURING_RESTART: Task["status"][] = ["planning", "acting", "verifying", "queued"]

export function isTerminalStatus(status: Task["status"]): boolean {
  return TERMINAL.includes(status)
}

export class TaskStore {
  readonly repoRoot: string
  readonly runsRoot: string
  private records = new Map<string, TaskRecord>()

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot
    this.runsRoot = join(repoRoot, ".repo-agent", "runs")
  }

  async init(): Promise<void> {
    await ensureDir(this.runsRoot)
    let entries: string[] = []
    try {
      entries = await readdir(this.runsRoot)
    } catch (error) {
      if (isMissingFile(error)) return
      throw error
    }
    for (const entry of entries) {
      const dir = join(this.runsRoot, entry)
      const task = await readJsonFileOrNull(join(dir, "meta.json"), TaskSchema)
      if (!task) continue
      const log = new EventLog(join(dir, "events.jsonl"))
      await log.load()
      this.records.set(task.id, { task, log, mutex: new Mutex() })
    }
  }

  async reconcileInterrupted(): Promise<Task[]> {
    const interrupted: Task[] = []
    for (const record of this.records.values()) {
      if (!ACTIVE_DURING_RESTART.includes(record.task.status)) continue
      const updated = await this.update(record.task.id, async (task) => {
        task.status = "failed"
        task.error = { code: "interrupted", message: "The runtime stopped while this task was active. Evidence and the worktree were kept." }
        await this.appendEventInternal(record, "run.interrupted", { previousStatus: record.task.status })
      })
      interrupted.push(updated)
    }
    return interrupted
  }

  list(): Task[] {
    return [...this.records.values()]
      .map((record) => record.task)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  get(id: string): TaskRecord | undefined {
    return this.records.get(id)
  }

  async create(task: Task): Promise<Task> {
    const dir = this.taskDir(task.id)
    await ensureDir(dir)
    const log = new EventLog(join(dir, "events.jsonl"))
    await log.load()
    const record: TaskRecord = { task, log, mutex: new Mutex() }
    this.records.set(task.id, record)
    await this.persist(record)
    return record.task
  }

  async update(id: string, mutate: (task: Task) => Promise<void> | void): Promise<Task> {
    const record = this.records.get(id)
    if (!record) throw new Error(`Unknown task: ${id}`)
    return record.mutex.run(async () => {
      const draft = structuredClone(record.task) as Task
      await mutate(draft)
      draft.version = record.task.version + 1
      draft.updatedAt = new Date().toISOString()
      record.task = draft
      await this.persist(record)
      return draft
    })
  }

  async appendEvent(id: string, type: Parameters<EventLog["append"]>[0]["type"], payload: Record<string, unknown> = {}): Promise<void> {
    const record = this.records.get(id)
    if (!record) throw new Error(`Unknown task: ${id}`)
    await this.appendEventInternal(record, type, payload)
  }

  private async appendEventInternal(record: TaskRecord, type: Parameters<EventLog["append"]>[0]["type"], payload: Record<string, unknown>): Promise<void> {
    await record.log.append({ runId: record.task.runId, taskId: record.task.id, type, payload })
  }

  async setPlan(id: string, plan: Plan): Promise<Task> {
    return this.update(id, async (task) => {
      task.plan = plan
    })
  }

  async setChecks(id: string, checks: Check[]): Promise<Task> {
    return this.update(id, async (task) => {
      task.checks = checks
    })
  }

  async reload(id: string): Promise<Task | null> {
    const task = await readJsonFileOrNull(join(this.taskDir(id), "meta.json"), TaskSchema)
    if (!task) return null
    const existing = this.records.get(id)
    if (!existing) {
      const log = new EventLog(join(this.taskDir(id), "events.jsonl"))
      await log.load()
      this.records.set(id, { task, log, mutex: new Mutex() })
      return task
    }
    if (task.version >= existing.task.version) existing.task = task
    return existing.task
  }

  eventLog(id: string): EventLog | undefined {
    return this.records.get(id)?.log
  }

  taskDir(id: string): string {
    return join(this.runsRoot, id)
  }

  /**
   * Snapshots are derived from the in-memory record, which is authoritative for the
   * owning process, and the event log is the durable record of a run. A transient
   * write failure (Windows file locks) must therefore never abort a run — the next
   * successful update rewrites the whole file.
   */
  private async persist(record: TaskRecord): Promise<void> {
    const dir = this.taskDir(record.task.id)
    const writes: Array<[string, unknown]> = [["plan.json", record.task.plan], ["checks.json", z.array(CheckSchema).parse(record.task.checks)], ["meta.json", record.task]]
    for (const [name, value] of writes) {
      if (value === null || value === undefined) continue
      try {
        await atomicWriteJson(join(dir, name), value)
      } catch (error) {
        console.error(`[task-store] failed to persist ${name} for ${record.task.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
}
