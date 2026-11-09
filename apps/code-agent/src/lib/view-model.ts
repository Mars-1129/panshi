import type { AgentEvent, Task as ServerTask } from "../../shared/types.ts"
import type { ChangedFile, DiffLine, EventKind, EventTone, Task, UiEvent } from "../types"

export function toTaskView(task: ServerTask, diff: Record<string, string>): Task {
  const succeeded = task.status === "succeeded"
  return {
    id: task.id,
    runId: task.runId,
    title: task.title,
    summary: task.summary,
    mode: task.mode,
    status: task.status,
    branch: task.branch,
    worktree: task.worktree,
    repo: task.repo,
    createdAt: formatTime(task.createdAt),
    updatedAt: formatTime(task.updatedAt),
    plan: task.plan ?? null,
    planSteps: (task.plan?.steps ?? []).map((step) => ({
      ...step,
      status: succeeded ? "done" : task.status === "acting" || task.status === "verifying" ? "active" : "pending",
    })),
    events: [],
    checks: task.checks,
    files: task.patches.map((patch): ChangedFile => ({
      path: patch.path,
      kind: patch.kind,
      additions: patch.additions,
      deletions: patch.deletions,
      verified: succeeded,
    })),
    findings: task.findings,
    diff,
    report: task.report ?? null,
    error: task.error ?? null,
    checkpoints: task.checkpoints,
    undoneAt: task.undoneAt,
    currentFile: task.patches[0]?.path ?? "",
  }
}

export function toUiEvent(event: AgentEvent): UiEvent {
  const payload = event.payload as Record<string, unknown>
  return {
    seq: event.seq,
    time: formatTime(event.time),
    title: eventTitle(event, payload),
    detail: eventDetail(event, payload),
    tone: eventTone(event, payload),
    kind: eventKind(event),
    turn: typeof payload.turn === "number" ? payload.turn : undefined,
  }
}

export function mergeEvents(current: AgentEvent[], incoming: AgentEvent[]): AgentEvent[] {
  const bySeq = new Map<number, AgentEvent>()
  for (const event of [...current, ...incoming]) bySeq.set(event.seq, event)
  return [...bySeq.values()].sort((left, right) => left.seq - right.seq)
}

export function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false
  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith("@@")) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
      if (match) {
        oldLine = Number(match[1])
        newLine = Number(match[2])
      }
      inHunk = true
      lines.push({ kind: "header", text: raw })
      continue
    }
    if (raw.startsWith("diff --git")) inHunk = false
    // Only treat the pre-hunk preamble as headers. Inside a hunk, `--- x` / `+++ x`
    // are ordinary removed/added lines whose content happens to start with "- " / "+ ".
    if (!inHunk && (raw.startsWith("diff --git") || raw.startsWith("index ") || raw.startsWith("--- ") || raw.startsWith("+++ ") || raw.startsWith("new file") || raw.startsWith("deleted file") || raw.startsWith("similarity index") || raw.startsWith("rename ") || raw.startsWith("old mode") || raw.startsWith("new mode") || raw.startsWith("Binary files"))) {
      lines.push({ kind: "header", text: raw })
      continue
    }
    if (raw.startsWith("\\ No newline")) {
      lines.push({ kind: "header", text: raw })
      continue
    }
    if (raw.startsWith("+")) {
      lines.push({ kind: "add", text: raw.slice(1), newLine })
      newLine += 1
      continue
    }
    if (raw.startsWith("-")) {
      lines.push({ kind: "remove", text: raw.slice(1), oldLine })
      oldLine += 1
      continue
    }
    lines.push({ kind: "context", text: raw.startsWith(" ") ? raw.slice(1) : raw, oldLine, newLine })
    oldLine += 1
    newLine += 1
  }
  return lines
}

export function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function eventTitle(event: AgentEvent, payload: Record<string, unknown>): string {
  switch (event.type) {
    case "task.created":
      return "任务已创建"
    case "plan.ready":
      return "计划已生成"
    case "approval.requested":
      return "等待审批"
    case "approval.resolved":
      return "计划已批准"
    case "plan.rejected":
      return "计划已退回"
    case "run.started":
      return "开始执行"
    case "run.queued":
      return "排队等待运行槽位"
    case "run.interrupted":
      return "运行时中断"
    case "run.succeeded":
      return "验证通过"
    case "run.failed":
      return "任务失败"
    case "run.cancelled":
      return "任务已取消"
    case "checkpoint.created":
      return `Checkpoint ${String(payload.checkpointId ?? "")}`
    case "checkpoint.restored":
      return "已恢复 Checkpoint"
    case "tool.started":
      return `调用工具 ${String(payload.tool ?? "")}`
    case "tool.finished":
      return `工具 ${String(payload.tool ?? "")} ${payload.ok ? "完成" : "失败"}`
    case "patch.created":
      return "写入文件"
    case "check.started":
      return `${payload.phase === "baseline" ? "基线" : "最终"}检查开始：${String(payload.label ?? "")}`
    case "check.finished":
      return `${payload.phase === "baseline" ? "基线" : "最终"}检查 ${String(payload.label ?? "")} ${statusText(String(payload.status ?? ""))}`
    case "verification.started":
      return "开始验证"
    case "provider.error":
      return "模型调用失败"
    case "system.note":
      return "运行记录"
    default:
      return event.type
  }
}

function statusText(status: string): string {
  if (status === "passed") return "通过"
  if (status === "failed") return "失败"
  if (status === "skipped") return "跳过"
  return status
}

function eventDetail(event: AgentEvent, payload: Record<string, unknown>): string {
  if (event.type === "plan.ready") {
    const plan = payload.plan as { summary?: string; checks?: unknown[] } | undefined
    return `${plan?.summary ?? ""} · ${plan?.checks?.length ?? 0} 条验证命令`
  }
  if (event.type === "check.finished") {
    const exit = payload.exitCode === null || payload.exitCode === undefined ? "n/a" : String(payload.exitCode)
    return `${String(payload.label ?? "")} · exit=${exit} · ${String(payload.durationMs ?? 0)}ms${payload.reason ? ` · ${String(payload.reason)}` : ""}`
  }
  if (event.type === "tool.finished") {
    const exit = payload.exitCode === null || payload.exitCode === undefined ? "" : ` exit=${String(payload.exitCode)}`
    return `${String(payload.tool ?? "")}${payload.error ? ` · ${String(payload.error)}` : ""}${exit}`
  }
  if (event.type === "run.failed") return `${String(payload.code ?? "error")}: ${String(payload.message ?? "")}`
  if (event.type === "approval.resolved") return payload.approved ? "批准了计划" : "拒绝了计划"
  if (event.type === "plan.rejected") return String(payload.reason ?? "计划被退回")
  if (event.type === "system.note") return String(payload.message ?? "").slice(0, 300)
  if (event.type === "patch.created") {
    const patches = Array.isArray(payload.patches) ? payload.patches : []
    return `${patches.length} 个文件发生变化`
  }
  if (payload.message) return String(payload.message).slice(0, 300)
  return ""
}

function eventTone(event: AgentEvent, payload: Record<string, unknown>): EventTone {
  if (event.type === "run.failed" || event.type === "provider.error" || event.type === "run.interrupted") return "danger"
  if (event.type === "tool.finished") return payload.ok ? "ok" : "danger"
  if (event.type === "check.finished") return payload.status === "passed" ? "ok" : payload.status === "skipped" ? "warn" : "danger"
  if (event.type === "run.succeeded" || event.type === "approval.resolved" || event.type === "run.started") return "ok"
  if (event.type === "run.cancelled" || event.type === "plan.rejected" || event.type === "check.started" || event.type === "verification.started") return "warn"
  if (event.type === "plan.ready" || event.type === "approval.requested" || event.type === "patch.created") return "accent"
  if (event.type === "tool.started" || event.type === "checkpoint.created" || event.type === "checkpoint.restored") return "info"
  return "neutral"
}

function eventKind(event: AgentEvent): EventKind {
  if (event.type.startsWith("check.") || event.type === "verification.started") return "check"
  if (event.type.startsWith("tool.") || event.type === "patch.created") return "tool"
  if (event.type.startsWith("approval.") || event.type === "plan.ready" || event.type === "plan.rejected") return "approval"
  if (event.type === "run.failed" || event.type === "run.succeeded" || event.type === "run.cancelled") return "system"
  return "system"
}
