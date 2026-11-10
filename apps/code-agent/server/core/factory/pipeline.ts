import { newRunId } from "../ids.ts"
import { RuntimeError } from "../errors.ts"
import type { AgentEvent } from "../../../shared/types.ts"
import type { StageRun } from "../../../shared/contracts.ts"
import { FactoryStore, ensureFactoryDirs } from "./store.ts"
import { acquireTaskLock, TaskLockError, type AcquiredLock } from "./task-lock.ts"
import { CONFIRM_REQUIRED, STAGE_NAMES, type EmitFn, type StageContext, type StageResult } from "./types.ts"
import type { CommandRunner } from "../command-runner.ts"
import type { Provider } from "../provider.ts"
import type { Git } from "../git.ts"
import type { Limits } from "../../../shared/types.ts"
import { STAGE_RUNNERS } from "./stages/index.ts"

export type PipelineDeps = {
  taskId: string
  runDir: string
  repoRoot: string
  runner: CommandRunner
  git: Git
  limits: Limits
  emit: EmitFn
  events?: () => Promise<AgentEvent[]>
  ai?: { enabled: boolean; provider: Provider | null }
  signal?: AbortSignal
}

const running = new Map<string, number>()

export class FactoryPipeline {
  private readonly deps: PipelineDeps

  constructor(deps: PipelineDeps) {
    this.deps = deps
  }

  get store(): FactoryStore {
    return new FactoryStore(this.deps.runDir)
  }

  async init(): Promise<void> {
    await this.store.init()
    await ensureFactoryDirs(this.store)
  }

  async listStages(): Promise<StageRun[]> {
    return this.store.listStages()
  }

  async listArtifacts() {
    return this.store.listArtifacts()
  }

  /** 执行单个工段。写入型工段必须先确认（confirm=true）。 */
  async runStage(stage: number, options: { confirm?: boolean } = {}): Promise<StageRun> {
    if (!Number.isInteger(stage) || stage < 0 || stage > 9) {
      throw new RuntimeError(400, "invalid_stage", `Unknown stage: ${stage}`)
    }
    if (running.has(this.deps.taskId)) {
      throw new RuntimeError(409, "stage_running", `Stage ${running.get(this.deps.taskId)} is already running for this task`)
    }
    if (CONFIRM_REQUIRED.has(stage) && !options.confirm) {
      throw new RuntimeError(409, "confirmation_required", `Stage ${stage} writes files; confirm it explicitly first`)
    }
    await this.init()
    // 进程内 Map 挡住同一进程的并发；磁盘锁挡住另一个进程（CLI、另一个 worker）。
    let diskLock: AcquiredLock
    try {
      diskLock = await acquireTaskLock(this.deps.runDir, stage)
    } catch (error) {
      if (error instanceof TaskLockError) {
        throw new RuntimeError(409, "task_locked", error.message)
      }
      throw error
    }
    running.set(this.deps.taskId, stage)
    try {
      return await this.execute(stage, options.confirm === true)
    } finally {
      running.delete(this.deps.taskId)
      await diskLock.release()
    }
  }

  /** MVP 全链路：0–8 顺序执行（失败不阻断后续），最后执行 9 汇总。 */
  async runAll(options: { confirm?: boolean } = {}): Promise<StageRun[]> {
    const results: StageRun[] = []
    for (let stage = 0; stage <= 8; stage += 1) {
      if (this.deps.signal?.aborted) return results
      try {
        results.push(await this.runStage(stage, { confirm: options.confirm || stage < 5 }))
      } catch (error) {
        if (error instanceof RuntimeError && error.code === "confirmation_required") {
          results.push(await this.markUnconfirmed(stage))
          continue
        }
        throw error
      }
    }
    results.push(await this.runStage(9, { confirm: true }))
    return results
  }

  private async markUnconfirmed(stage: number): Promise<StageRun> {
    const run: StageRun = {
      stageRunId: newRunId(),
      taskId: this.deps.taskId,
      stage,
      status: "blocked",
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      failure: { code: "confirmation_required", message: "写入型工段需要显式确认", at: new Date().toISOString() },
      artifacts: [],
      notes: [],
    }
    await this.store.writeStage(run)
    return run
  }

  private async execute(stage: number, confirm: boolean): Promise<StageRun> {
    // 取消发生在工段之间：上一个工段可能刚跑完，这里立刻停下。
    if (this.deps.signal?.aborted) {
      throw new RuntimeError(499, "cancelled", "运行已取消")
    }
    const store = this.store
    const previous = await store.readStage(stage)
    if (previous?.status === "running") {
      throw new RuntimeError(409, "stage_running", `Stage ${stage} is already running`)
    }
    const stageRun: StageRun = {
      stageRunId: newRunId(),
      taskId: this.deps.taskId,
      stage,
      status: "running",
      startedAt: new Date().toISOString(),
      artifacts: [],
      notes: [],
    }
    await store.writeStage(stageRun)
    await this.deps.emit("stage.started", { stageId: stage, stageName: STAGE_NAMES[stage], stageRunId: stageRun.stageRunId })

    const events = this.deps.events ? await this.deps.events() : []
    const context: StageContext = {
      taskId: this.deps.taskId,
      stage,
      stageRun,
      repoRoot: this.deps.repoRoot,
      runDir: this.deps.runDir,
      store,
      runner: this.deps.runner,
      git: this.deps.git,
      limits: this.deps.limits,
      emit: async (type, payload) => { await this.deps.emit(type, { stageId: stage, stageRunId: stageRun.stageRunId, ...payload }) },
      confirm,
      events,
      ai: this.deps.ai ?? { enabled: false, provider: null },
      signal: this.deps.signal,
    }

    let result: StageResult
    try {
      const runner = STAGE_RUNNERS[stage]
      if (!runner) throw new Error(`No runner registered for stage ${stage}`)
      result = await runner(context)
    } catch (error) {
      result = {
        status: "failed",
        code: error instanceof Error && "code" in error ? String((error as { code: unknown }).code) : "stage_error",
        message: error instanceof Error ? error.message : String(error),
      }
    }

    const finished: StageRun = {
      ...stageRun,
      status: result.status,
      finishedAt: new Date().toISOString(),
      artifacts: result.artifacts ?? stageRun.artifacts,
      notes: result.notes ?? [],
      failure: result.status === "succeeded" ? undefined : { code: result.code ?? "stage_failed", message: result.message ?? "工段未完成", at: new Date().toISOString() },
    }
    await store.writeStage(finished)

    for (const artifact of finished.artifacts) {
      await this.deps.emit("artifact.created", {
        artifactId: artifact.artifactId,
        stageId: stage,
        name: artifact.name,
        kind: artifact.kind,
        hash: artifact.hash,
        bytes: artifact.bytes,
        path: artifact.path,
        producedBy: artifact.producedBy,
      })
    }

    if (finished.status === "succeeded") {
      await this.deps.emit("stage.completed", {
        stageId: stage,
        stageName: STAGE_NAMES[stage],
        stageRunId: finished.stageRunId,
        artifactIds: finished.artifacts.map((item) => item.artifactId),
        durationMs: Date.parse(finished.finishedAt ?? finished.startedAt) - Date.parse(finished.startedAt),
      })
    } else if (finished.status === "not_applicable") {
      // 该仓库没有这个工段适用的对象。不是失败，也从进度分母中排除。
      await this.deps.emit("stage.skipped", {
        stageId: stage,
        stageName: STAGE_NAMES[stage],
        stageRunId: finished.stageRunId,
        code: finished.failure?.code ?? "not_applicable",
        message: finished.failure?.message ?? "本工段不适用于该仓库",
      })
    } else {
      await this.deps.emit("stage.failed", {
        stageId: stage,
        stageName: STAGE_NAMES[stage],
        stageRunId: finished.stageRunId,
        code: finished.failure?.code ?? "stage_failed",
        message: finished.failure?.message ?? "工段未完成",
        status: finished.status,
      })
    }
    return finished
  }
}
