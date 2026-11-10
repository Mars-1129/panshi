import type {
  AgentEvent,
  Check,
  Health,
  Patch,
  Plan,
  Report,
  RepoSummary,
  Task as ServerTask,
  TaskMode,
} from "../shared/types.ts"

export type { AgentEvent, Check, Health, Patch, Plan, Report, RepoSummary, ServerTask }

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

const MUTATION_HEADERS = {
  "Content-Type": "application/json",
  "X-RepoPilot-Request": "1",
}

export type AiStatus = { configured: boolean; provider: string; model: string; baseUrl: string; source: "ui" | "env" | "none"; updatedAt: string | null }

export async function getAiStatus(): Promise<AiStatus> {
  return request("/api/runtime/ai")
}

export async function configureAi(input: { provider?: string; baseUrl: string; model: string; apiKey: string }): Promise<AiStatus> {
  return request("/api/runtime/ai", { method: "POST", headers: MUTATION_HEADERS, body: JSON.stringify(input) })
}

export async function clearAi(): Promise<AiStatus> {
  return request("/api/runtime/ai", { method: "DELETE", headers: MUTATION_HEADERS })
}

export async function runtimeHealth(): Promise<Health> {
  return request<Health>("/api/runtime/health")
}

export async function runtimeRepo(): Promise<{ repo: string; ready: boolean; error: string | null; summary: RepoSummary | null }> {
  return request("/api/runtime/repo")
}

export async function deleteRuntimeProject(id: string): Promise<{ deleted: boolean }> {
  return request(`/api/runtime/projects/${encodeURIComponent(id)}`, { method: "DELETE", headers: MUTATION_HEADERS })
}

export async function openRuntimeRepo(path: string): Promise<{ repo: string; ready: boolean; summary: RepoSummary | null }> {
  return request("/api/runtime/repo", { method: "POST", headers: MUTATION_HEADERS, body: JSON.stringify({ path }) })
}

export async function listRuntimeTasks(): Promise<{ tasks: ServerTask[] }> {
  return request("/api/runtime/tasks")
}

export async function getRuntimeTask(id: string): Promise<{ task: ServerTask }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}`)
}

export type ProjectDraftInput = {
  product: string
  description: string
  entities: Array<{ table: string; label: string; fields: Array<{ name: string; type: string }> }>
}

export async function createRuntimeProject(draft: ProjectDraftInput): Promise<{ project: { id: string; path: string; product: string; anchors: number }; repo: RepoSummary | null }> {
  return request("/api/runtime/projects", { method: "POST", headers: MUTATION_HEADERS, body: JSON.stringify(draft) })
}

export async function listRuntimeProjects(): Promise<{ projects: Array<{ id: string; product: string; path: string }>; root: string }> {
  return request("/api/runtime/projects")
}

export async function createRuntimeTask(input: { title: string; summary: string; mode: TaskMode }): Promise<{ task: ServerTask }> {
  return request("/api/runtime/tasks", { method: "POST", headers: MUTATION_HEADERS, body: JSON.stringify(input) })
}

export async function approveRuntimeTask(id: string, planHash?: string): Promise<{ task: ServerTask }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: MUTATION_HEADERS,
    body: JSON.stringify(planHash ? { planHash } : {}),
  })
}

export async function rejectRuntimeTask(id: string, reason: string): Promise<{ task: ServerTask }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: MUTATION_HEADERS,
    body: JSON.stringify({ reason }),
  })
}

/** 查询任务锁：是否有别的进程正在执行这个任务。 */
export async function fetchFactoryLock(id: string): Promise<{ lock: { pid: number; stage: number; acquiredAt: string } | null }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/stages`)
}

/** 取消正在跑的工厂任务。返回是否真的有在跑的任务被中止。 */
export async function cancelFactoryRun(id: string): Promise<{ cancelled: boolean }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/stages/cancel`, {
    method: "POST",
    headers: MUTATION_HEADERS,
    body: "{}",
  })
}

export async function cancelRuntimeTask(id: string): Promise<{ task: ServerTask }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: MUTATION_HEADERS,
    body: "{}",
  })
}

export async function undoRuntimeTask(id: string, checkpointId?: string): Promise<{ task: ServerTask }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/undo`, {
    method: "POST",
    headers: MUTATION_HEADERS,
    body: JSON.stringify(checkpointId ? { checkpointId } : {}),
  })
}

export async function fetchRuntimeDiff(id: string): Promise<{ patches: Patch[]; diff: Record<string, string>; truncated: boolean }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/diff`)
}

export type ContractBundleView = { version: number; hash: string; locked: boolean; kinds?: string[]; contents: Record<string, string>; lockedAt?: string }

export async function getFactoryContracts(id: string): Promise<{ bundle: ContractBundleView | null }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/contracts`)
}

export async function fetchRuntimeEvents(id: string, after = 0): Promise<{ events: AgentEvent[] }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/events?json=1&after=${after}`)
}


export async function runFactoryStage(id: string, stage: number, confirm = false): Promise<{ started: boolean; stage: number }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/stages/${stage}/run`, {
    method: "POST", headers: MUTATION_HEADERS, body: JSON.stringify({ confirm }),
  })
}

export async function runFactoryAll(id: string, confirm = false): Promise<{ started: boolean }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/stages/run-all`, {
    method: "POST", headers: MUTATION_HEADERS, body: JSON.stringify({ confirm }),
  })
}

export async function fetchFactoryStages(id: string): Promise<{ stages: unknown[] }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/stages`)
}

export async function fetchFactoryArtifacts(id: string): Promise<{ artifacts: unknown[] }> {
  return request(`/api/runtime/tasks/${encodeURIComponent(id)}/artifacts`)
}

export type EventSubscription = {
  close: () => void
}

export function subscribeRuntimeEvents(
  id: string,
  after: number,
  onEvent: (event: AgentEvent) => void,
  onState: (state: "live" | "reconnecting" | "offline" | "snapshot") => void,
): EventSubscription {
  const source = new EventSource(`/api/runtime/tasks/${encodeURIComponent(id)}/events?after=${after}`)
  let closedByServer = false
  source.onopen = () => onState("live")
  source.onmessage = (message) => {
    try {
      const payload = JSON.parse(message.data) as { type?: string; event?: AgentEvent }
      if (payload.type === "event" && payload.event) onEvent(payload.event)
    } catch {
      // Ignore malformed frames; the next snapshot will resynchronize.
    }
  }
  source.addEventListener("done", () => {
    closedByServer = true
    source.close()
    onState("snapshot")
  })
  source.onerror = () => {
    if (closedByServer || source.readyState === EventSource.CLOSED) return
    onState("reconnecting")
  }
  return {
    close: () => {
      closedByServer = true
      source.close()
    },
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null
    throw new ApiError(response.status, body?.error?.code ?? "request_failed", body?.error?.message ?? `Request failed with ${response.status}`)
  }
  return (await response.json()) as T
}
