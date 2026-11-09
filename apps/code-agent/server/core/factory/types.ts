import type { CommandRunner } from "../command-runner.ts"
import type { Provider } from "../provider.ts"
import type { Git } from "../git.ts"
import type { Limits } from "../../../shared/types.ts"
import type { AgentEvent } from "../../../shared/types.ts"
import type { Artifact, FactoryEventType, StageRun } from "../../../shared/contracts.ts"
import type { FactoryStore } from "./store.ts"

export type EmitFn = (type: FactoryEventType, payload: Record<string, unknown>) => Promise<void>

export type StageContext = {
  taskId: string
  stage: number
  stageRun: StageRun
  repoRoot: string
  runDir: string
  store: FactoryStore
  runner: CommandRunner
  git: Git
  limits: Limits
  emit: EmitFn
  confirm: boolean
  events: AgentEvent[]
  ai: { enabled: boolean; provider: Provider | null }
  signal?: AbortSignal
}

export type StageRunner = (ctx: StageContext) => Promise<StageResult>

export type StageResult = {
  /**
   * not_applicable 表示「本仓库没有该工段适用的对象」。
   * 它不是失败：进度分母会排除它，交付判定也不会因此变为未通过。
   */
  status: "succeeded" | "failed" | "blocked" | "not_applicable"
  code?: string
  message?: string
  artifacts?: Artifact[]
  notes?: string[]
}

export const STAGE_NAMES: Record<number, string> = {
  0: "接入基线",
  1: "环境救活",
  2: "业务考古",
  3: "二进制对拍",
  4: "技能封装",
  5: "需求 / 契约",
  6: "多角色制造",
  7: "护栏",
  8: "双擎质检",
  9: "RSI 交付",
}

/** 写入型工段需要显式二次确认（破坏性动作两步确认）。 */
export const CONFIRM_REQUIRED: ReadonlySet<number> = new Set([5, 6])
