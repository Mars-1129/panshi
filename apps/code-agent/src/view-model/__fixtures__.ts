/**
 * 前端测试夹具：构造工厂事件流与 FactorySource。
 *
 * 这些夹具只用于测试，不参与生产构建（文件名不在任何入口的依赖图里）。
 * 事件形状必须与 shared/schemas.ts 的 AgentEventSchema 一致，否则夹具本身就会骗人。
 */

import type { FactorySource } from "./factory-types"
import type { AgentEvent, RepoSummary, ServerTask } from "../types"

let seq = 0

/** 重置序号，让每个用例的 seq 从 0 开始，避免断言依赖执行顺序。 */
export function resetSeq(): void {
  seq = 0
}

type Payload = Record<string, unknown>

/** 造一条事件。stageId 自动带进 payload，与工厂事件的真实形状一致。 */
export function event(type: string, stageId: number | null, payload: Payload = {}): AgentEvent {
  seq += 1
  return {
    seq,
    runId: "run_test",
    taskId: "task_test",
    time: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    type: type as AgentEvent["type"],
    payload: stageId === null ? payload : { stageId, stageRunId: `srun_${stageId}`, ...payload },
  }
}

/** 一个工段完成：stage.started → stage.completed */
export function stageDone(stageId: number, extra: Payload = {}): AgentEvent[] {
  return [event("stage.started", stageId), event("stage.completed", stageId, extra)]
}

/** 一个工段被阻断。status 缺省是 blocked，传 "failed" 可造失败态。 */
export function stageBlocked(stageId: number, code: string, message: string, status: "blocked" | "failed" = "blocked"): AgentEvent[] {
  return [
    event("stage.started", stageId),
    event("stage.failed", stageId, { code, message, status }),
  ]
}

/** 不适用：新语义下走 stage.skipped。 */
export function stageSkipped(stageId: number, message = "本工段不适用"): AgentEvent[] {
  return [event("stage.started", stageId), event("stage.skipped", stageId, { message })]
}

export function repo(overrides: Partial<RepoSummary> = {}): RepoSummary {
  return {
    root: "/repo",
    name: "repo",
    isGit: true,
    baseRevision: "abc123",
    languages: ["JavaScript"],
    packageManager: "npm",
    scripts: {},
    entrypoints: ["src/index.mjs"],
    hasUncommittedChanges: false,
    ...overrides,
  }
}

export function task(overrides: Partial<ServerTask> = {}): ServerTask {
  return {
    id: "task_test",
    title: "测试任务",
    status: "succeeded",
    mode: "generate",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    baseRevision: "abc123",
    ...overrides,
  } as ServerTask
}

export function source(events: AgentEvent[], overrides: Partial<FactorySource> = {}): FactorySource {
  return {
    task: task(),
    events,
    repo: repo(),
    runtimeReachable: true,
    ...overrides,
  }
}

/** 十工段全部成功的完整事件流。 */
export function allStagesDone(): AgentEvent[] {
  const out: AgentEvent[] = []
  for (let stage = 0; stage <= 9; stage += 1) out.push(...stageDone(stage))
  return out
}
