import { join, resolve } from "node:path"
import { rm, stat } from "node:fs/promises"
import { FindingSchema, PlanSchema, type FactoryState } from "../../shared/schemas.ts"
import type { AgentEvent, Check, Finding, Health, Limits, Patch, Plan, PlanCheck, RepoSummary, Task, TaskMode } from "../../shared/types.ts"
import { inferChecks, runChecks, summarizeChecks } from "./checks.ts"
import { readCustomChecks } from "./custom-checks.ts"
import { formatRulesForPrompt, readProjectRules } from "./project-rules.ts"
import { probeSandbox, resolveSandboxConfig } from "./sandbox.ts"
import { CommandRunner } from "./command-runner.ts"
import { APP_VERSION, type Config } from "./config.ts"
import { BudgetError, CancelledError, RuntimeError } from "./errors.ts"
import { summarizeRepo, isDirectory } from "./repo.ts"
import { buildReport, collectUnverified } from "./report.ts"
import { Git } from "./git.ts"
import { newRunId, newTaskId, shortHash } from "./ids.ts"
import { assertTransition, isTerminal } from "./lifecycle.ts"
import { HttpProvider, ProviderError, type PlanDraft, type Provider, type ProviderMessage, type ToolSpec } from "./provider.ts"
import { clearAiSettings, loadAiSettings, saveAiSettings, type AiSettings } from "./ai-settings.ts"
import { TaskStore } from "./task-store.ts"
import { executeTool, type ToolCall, type ToolContext } from "./tools.ts"
import { FactoryPipeline } from "./factory/pipeline.ts"
import { peekTaskLock } from "./factory/task-lock.ts"
import { summarizeFactory } from "./factory/summary.ts"
import { createProjectDir, listProjects, type ProjectDraft } from "./projects.ts"
import { isMissingFile } from "./fs-utils.ts"
import type { ContractBundle, StageRun } from "../../shared/contracts.ts"
import { access, readFile } from "node:fs/promises"

export type RuntimeOptions = {
  config: Config
  provider: Provider
  repoRoot?: string
  maxConcurrentRuns?: number
  /**
   * Mark tasks left in an active state by a previous process as interrupted.
   * Only the process that owns the runtime should do this; a CLI must not,
   * or it would fail tasks that a running server is actively executing.
   */
  reconcileInterrupted?: boolean
}

type ActiveRun = {
  controller: AbortController
  promise: Promise<void>
}

class Semaphore {
  private available: number
  private waiters: Array<() => void> = []

  constructor(count: number) {
    this.available = Math.max(1, count)
  }

  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1
      return Promise.resolve()
    }
    return new Promise<void>((resolvePromise) => this.waiters.push(resolvePromise))
  }

  release(): void {
    const next = this.waiters.shift()
    if (next) next()
    else this.available += 1
  }
}

export class Runtime {
  readonly config: Config
  provider: Provider
  private aiSource: "ui" | "env" | "none" = "none"
  private aiBaseUrl = ""
  private aiSettings: AiSettings | null = null
  private runner = new CommandRunner()
  private git: Git
  private store: TaskStore | null = null
  private repoRoot: string
  private repoError: string | null = null
  private summary: RepoSummary | null = null
  private planning = new Map<string, Promise<void>>()
  private active = new Map<string, ActiveRun>()
  private semaphore: Semaphore
  private reconcile: boolean

  constructor(options: RuntimeOptions) {
    this.config = options.config
    this.provider = options.provider
    this.aiSource = options.config.provider.configured ? "env" : "none"
    this.aiBaseUrl = options.config.provider.baseUrl
    this.git = new Git(this.runner)
    this.repoRoot = resolve(options.repoRoot ?? options.config.repoRoot)
    this.semaphore = new Semaphore(options.maxConcurrentRuns ?? 1)
    this.reconcile = options.reconcileInterrupted ?? true
  }

  async init(): Promise<void> {
    await this.loadAiSettings()
    try {
      await this.useRepo(this.repoRoot)
    } catch (error) {
      this.repoError = error instanceof Error ? error.message : "Repository is not available"
      this.store = null
    }
  }

  async useRepo(path: string): Promise<void> {
    if (path.startsWith("\\\\")) {
      throw new RuntimeError(400, "invalid_repo", "UNC paths are not supported; use a local directory")
    }
    const target = resolve(path)
    if (!(await isDirectory(target))) throw new RuntimeError(400, "invalid_repo", `Repository directory does not exist: ${target}`)
    await this.git.assertRepository(target)
    const store = new TaskStore(target)
    await store.init()
    if (this.reconcile) await store.reconcileInterrupted()
    this.repoRoot = target
    this.store = store
    this.summary = await summarizeRepo(target, this.git)
    this.repoError = null
  }

  health(): Health {
    return {
      ok: true,
      provider: this.provider.name,
      model: this.provider.model,
      configured: this.providerConfigured(),
      repo: this.repoRoot,
      repoReady: this.repoReady(),
      repoError: this.repoError,
      limits: this.config.limits,
      version: APP_VERSION,
      sandbox: this.sandboxStatus(),
    }
  }

  /** 命令在哪执行：装机时探测一次，界面用来提示"这条命令跑在容器里还是宿主机上"。 */
  private sandboxStatus() {
    const config = resolveSandboxConfig()
    const probe = probeSandbox(config)
    return probe.available
      ? { kind: config.kind, available: true, detail: probe.detail }
      : { kind: config.kind, available: false, detail: probe.reason }
  }

  private providerConfigured(): boolean {
    return this.aiSource !== "none"
  }

  private aiConfigPath(): string {
    return this.config.aiConfigPath ?? resolve("../../runtime-workspace/ai.json")
  }

  private async loadAiSettings(): Promise<void> {
    const settings = await loadAiSettings(this.aiConfigPath())
    if (settings) {
      this.applyAi(settings, "ui")
      return
    }
    this.aiSource = this.config.provider.configured ? "env" : "none"
  }

  private applyAi(settings: AiSettings, source: "ui" | "env"): void {
    this.aiSettings = settings
    this.aiSource = source
    this.aiBaseUrl = settings.baseUrl
    this.provider = new HttpProvider({ name: settings.provider, baseUrl: settings.baseUrl, model: settings.model, apiKey: settings.apiKey })
  }

  aiStatus() {
    return {
      configured: this.providerConfigured(),
      provider: this.provider.name,
      model: this.provider.model,
      baseUrl: this.aiBaseUrl,
      source: this.aiSource,
      updatedAt: this.aiSettings?.updatedAt ?? null,
    }
  }

  async configureAi(input: { provider?: string; baseUrl: string; model: string; apiKey: string }) {
    const baseUrl = input.baseUrl.trim().replace(/\/+$/, "")
    const model = input.model.trim()
    const apiKey = input.apiKey.trim()
    const provider = (input.provider ?? "openai-compatible").trim() || "openai-compatible"
    if (!/^https?:\/\//.test(baseUrl)) throw new RuntimeError(400, "invalid_ai", "Base URL 需要以 http(s):// 开头")
    if (!model) throw new RuntimeError(400, "invalid_ai", "模型名称不能为空")
    if (apiKey.length < 8) throw new RuntimeError(400, "invalid_ai", "API Key 看起来不完整")

    const candidate = new HttpProvider({ name: provider, baseUrl, model, apiKey })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      await candidate.chat({ system: "", messages: [{ role: "user", content: "只回复两个字：可用" }], tools: [], signal: controller.signal })
    } catch (error) {
      throw new RuntimeError(400, "ai_unreachable", "AI 连接测试失败：" + (error instanceof Error ? error.message : String(error)))
    } finally {
      clearTimeout(timer)
    }

    const settings: AiSettings = { provider, baseUrl, model, apiKey, updatedAt: new Date().toISOString() }
    await saveAiSettings(this.aiConfigPath(), settings)
    this.applyAi(settings, "ui")
    return this.aiStatus()
  }

  async clearAi() {
    await clearAiSettings(this.aiConfigPath())
    this.aiSettings = null
    this.aiSource = this.config.provider.configured ? "env" : "none"
    this.aiBaseUrl = this.config.provider.baseUrl
    return this.aiStatus()
  }

  repoSummary(): RepoSummary | null {
    return this.summary
  }

  repoReady(): boolean {
    return this.store !== null && this.repoError === null
  }

  repoFailure(): string | null {
    return this.repoError
  }

  listTasks(): Task[] {
    return this.requireStore().list()
  }

  getTask(id: string): Task {
    return this.requireTask(id)
  }

  async refreshTask(id: string): Promise<Task> {
    const refreshed = await this.requireStore().reload(id)
    if (!refreshed) throw new RuntimeError(404, "not_found", `Unknown task: ${id}`)
    return refreshed
  }

  async createTask(input: { title: string; summary: string; mode: TaskMode }): Promise<Task> {
    const store = this.requireStore()
    const summary = this.requireSummary()
    const now = new Date().toISOString()
    const id = newTaskId()
    const runId = newRunId()
    const task: Task = {
      id,
      runId,
      title: input.title,
      summary: input.summary,
      mode: input.mode,
      status: this.providerConfigured() ? "planning" : "blocked",
      repo: this.repoRoot,
      baseRevision: summary.baseRevision,
      branch: `rp/${id}`,
      worktree: this.git.worktreePath(this.repoRoot, id),
      plan: null,
      patches: [],
      checks: [],
      findings: [],
      checkpoints: [],
      error: this.providerConfigured()
        ? null
        : { code: "provider_unconfigured", message: "No model API key is configured. Set REPOPILOT_API_KEY or SILICONFLOW_API_KEY and restart." },
      createdAt: now,
      updatedAt: now,
      version: 0,
    }
    await store.create(task)
    await store.appendEvent(id, "task.created", {
      mode: task.mode,
      title: task.title,
      repo: this.repoRoot,
      baseRevision: summary.baseRevision ?? null,
    })
    if (!this.providerConfigured()) {
      await store.appendEvent(id, "system.note", { message: task.error?.message ?? "Provider is not configured" })
      return this.getTask(id)
    }
    const planning = this.planTask(id).finally(() => {
      this.planning.delete(id)
    })
    this.planning.set(id, planning)
    return this.getTask(id)
  }

  async approve(id: string, planHash?: string): Promise<Task> {
    const task = this.requireTask(id)
    if (task.status === "acting" || task.status === "verifying" || task.status === "queued") {
      if (planHash && task.plan && planHash !== task.plan.hash) throw new RuntimeError(409, "stale_plan", "The plan changed; approve the current plan")
      return task
    }
    if (task.status !== "awaiting_approval") {
      throw new RuntimeError(409, "invalid_state", `Task is ${task.status}; only awaiting_approval can be approved`)
    }
    if (!task.plan) throw new RuntimeError(409, "plan_missing", "The task has no plan to approve")
    if (planHash && planHash !== task.plan.hash) throw new RuntimeError(409, "stale_plan", "The plan changed; approve the current plan")
    if (!this.providerConfigured()) throw new RuntimeError(409, "provider_unconfigured", "No model API key is configured")

    // Register the abort controller before any await so a cancel arriving during
    // the approval itself can still stop the run.
    const controller = new AbortController()
    let alreadyStarted = false
    const started = await this.requireStore().update(id, (draft) => {
      // Concurrent approvals race here; only the first one may start a run.
      if (draft.status === "acting" || draft.status === "verifying" || draft.status === "queued") {
        alreadyStarted = true
        return
      }
      if (draft.status !== "awaiting_approval") {
        throw new RuntimeError(409, "invalid_state", `Task is ${draft.status}; approval did not start a run`)
      }
      assertTransition(draft.status, "acting")
      draft.status = "acting"
    })
    if (alreadyStarted || started.status !== "acting") return started

    this.active.set(id, { controller, promise: Promise.resolve() })
    const promise = this.runTask(id, controller.signal)
      .catch(async (error: unknown) => {
        await this.handleRunFailure(id, error)
      })
      .finally(() => {
        this.active.delete(id)
      })
    const entry = this.active.get(id)
    if (entry) entry.promise = promise

    void this.safeAppend(id, "approval.resolved", { approved: true, planHash: task.plan.hash })
    void this.safeAppend(id, "run.started", { branch: task.branch, worktree: task.worktree })
    return this.getTask(id)
  }

  async reject(id: string, reason: string): Promise<Task> {
    const task = this.requireTask(id)
    if (task.status !== "awaiting_approval") {
      throw new RuntimeError(409, "invalid_state", `Task is ${task.status}; only awaiting_approval can be rejected`)
    }
    const rejected = await this.requireStore().update(id, (draft) => {
      if (draft.status !== "awaiting_approval") {
        throw new RuntimeError(409, "invalid_state", `Task is ${draft.status}; it can no longer be rejected`)
      }
      assertTransition(draft.status, "cancelled")
      draft.status = "cancelled"
      draft.error = { code: "rejected", message: reason || "The plan was rejected" }
    })
    if (rejected.status !== "cancelled") return rejected
    await this.requireStore().appendEvent(id, "plan.rejected", { reason })
    await this.requireStore().appendEvent(id, "run.cancelled", { reason: "rejected" })
    return this.getTask(id)
  }

  async cancel(id: string): Promise<Task> {
    const task = this.requireTask(id)
    if (isTerminal(task.status)) {
      // Still make sure no orphan run is left behind.
      const active = this.active.get(id)
      active?.controller.abort()
      return task
    }
    const active = this.active.get(id)
    active?.controller.abort()
    await this.requireStore().update(id, (draft) => {
      if (!isTerminal(draft.status)) {
        draft.status = "cancelled"
        draft.error = { code: "cancelled", message: "The run was cancelled; evidence and the worktree were kept." }
      }
    })
    await this.requireStore().appendEvent(id, "run.cancelled", {})
    // Wait for the run to actually unwind so callers never see a "cancelled"
    // task whose agent is still writing. Bounded: a wedged provider is abandoned.
    if (active) await Promise.race([active.promise, delay(15_000)])
    return this.getTask(id)
  }

  async undo(id: string, checkpointId?: string): Promise<Task> {
    const task = this.requireTask(id)
    if (!isTerminal(task.status)) throw new RuntimeError(409, "invalid_state", "Only a finished task can be undone")
    if (this.active.has(id)) throw new RuntimeError(409, "run_active", "The run has not fully stopped yet; retry in a moment")
    const checkpoint = checkpointId
      ? task.checkpoints.find((item) => item.id === checkpointId)
      : task.checkpoints.at(-1)
    if (!checkpoint) throw new RuntimeError(409, "checkpoint_missing", "No checkpoint is available")
    try {
      await access(task.worktree)
    } catch {
      throw new RuntimeError(409, "worktree_missing", "The worktree no longer exists")
    }
    await this.git.resetTo(task.worktree, checkpoint.commit)
    const baseRevision = task.baseRevision ?? checkpoint.commit
    const patches = task.mode === "review" ? [] : await this.computePatches(task.worktree, baseRevision)
    await this.requireStore().update(id, (draft) => {
      draft.status = "cancelled"
      draft.undoneAt = new Date().toISOString()
      draft.patches = patches
      draft.report = null
      draft.error = { code: "undone", message: `Restored to ${checkpoint.id}` }
    })
    await this.requireStore().appendEvent(id, "checkpoint.restored", { checkpointId: checkpoint.id, commit: checkpoint.commit })
    return this.getTask(id)
  }

  async events(id: string, afterSeq = 0): Promise<AgentEvent[]> {
    const log = this.requireStore().eventLog(id)
    if (!log) throw new RuntimeError(404, "not_found", `Unknown task: ${id}`)
    return log.read(afterSeq)
  }

  subscribeEvents(id: string, listener: (event: AgentEvent) => void): () => void {
    const log = this.requireStore().eventLog(id)
    if (!log) throw new RuntimeError(404, "not_found", `Unknown task: ${id}`)
    return log.subscribe(listener)
  }

  async diff(id: string): Promise<{ patches: Patch[]; diff: Record<string, string>; truncated: boolean }> {
    const task = this.requireTask(id)
    if (task.mode === "review" || task.undoneAt) return { patches: task.patches, diff: {}, truncated: false }
    try {
      await access(task.worktree)
    } catch {
      return { patches: task.patches, diff: {}, truncated: false }
    }
    const baseRevision = task.baseRevision
    if (!baseRevision) return { patches: task.patches, diff: {}, truncated: false }
    const diff: Record<string, string> = {}
    const batch = task.patches.slice(0, MAX_DIFF_FILES)
    for (const patch of batch) {
      diff[patch.path] = await this.git.diffForFile(task.worktree, baseRevision, patch.path, this.config.limits.maxDiffBytes, patch.oldPath)
    }
    return { patches: task.patches, diff, truncated: task.patches.length > MAX_DIFF_FILES }
  }

  async waitForTask(id: string): Promise<void> {
    const planning = this.planning.get(id)
    if (planning) await planning
    const active = this.active.get(id)
    if (active) await active.promise
  }

  async waitForAll(): Promise<void> {
    await Promise.all([...this.planning.values(), ...[...this.active.values()].map((run) => run.promise)])
  }

  private async planTask(id: string): Promise<void> {
    const store = this.requireStore()
    try {
      const task = this.requireTask(id)
      const summary = this.requireSummary()
      const fileList = await this.git.listTrackedFiles(this.repoRoot)
      const draft = await this.provider.plan({
        task: { title: task.title, summary: task.summary, mode: task.mode },
        repo: summary,
        fileList,
      })
      const plan = await this.buildPlan(draft, summary, task.mode)
      await store.update(id, (current) => {
        assertTransition(current.status, "awaiting_approval")
        current.status = "awaiting_approval"
        current.plan = plan
      })
      await store.appendEvent(id, "plan.ready", { plan })
      await store.appendEvent(id, "approval.requested", { planHash: plan.hash })
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : "planning_error"
      const message = error instanceof Error ? error.message : "Planning failed"
      const current = this.requireStore().get(id)
      if (!current || isTerminal(current.task.status)) return
      await store.update(id, (draft) => {
        if (isTerminal(draft.status)) return
        draft.status = "failed"
        draft.error = { code, message }
      })
      await store.appendEvent(id, "provider.error", { code, message })
      await store.appendEvent(id, "run.failed", { code, message })
    }
  }

  private async buildPlan(draft: PlanDraft, summary: RepoSummary, mode: TaskMode): Promise<Plan> {
    const steps = draft.steps.map((step, index) => ({
      id: `step_${index + 1}`,
      title: step.title,
      detail: step.detail,
      status: "pending" as const,
    }))
    // 仓库声明的 `.repopilot/checks.json` 优先于推断：业务方说什么就执行什么。
    let checks: PlanCheck[] = []
    const risks = [...draft.risks]
    if (mode !== "review") {
      const custom = await readCustomChecks(this.repoRoot)
      if (custom.kind === "checks") {
        checks = custom.checks
      } else {
        if (custom.kind === "invalid") {
          // 声明了但读不懂：如实告警，不静默回落到推断
          risks.push(`自定义检查配置无效（${custom.reason}），已回落到自动推断。`)
        }
        checks = inferChecks(summary)
      }
    }
    if (mode !== "review" && checks.length === 0) {
      risks.push("No verification command was detected. This task cannot succeed until a check exists.")
    }
    if (mode === "review") {
      risks.push("Read-only review: no commands run and the repository is not modified.")
    }
    const plan: Plan = {
      version: 1,
      hash: "",
      summary: draft.summary || "No summary was produced.",
      steps,
      files: draft.files,
      checks,
      risks,
    }
    plan.hash = shortHash(JSON.stringify({ summary: plan.summary, steps: plan.steps, files: plan.files, checks: plan.checks }))
    return PlanSchema.parse(plan)
  }

  /** 系统提示词 = 基础规则 + 仓库自己的规则文件（AGENTS.md / .repopilot/rules.md / CLAUDE.md）。 */
  private async systemPrompt(task: Task, plan: Plan, review: boolean): Promise<string> {
    const base = buildSystemPrompt(task, plan, this.requireSummary(), this.config.limits, review)
    const rules = await readProjectRules(this.repoRoot)
    const section = formatRulesForPrompt(rules)
    return section ? `${base}

${section}` : base
  }

  private async safeAppend(id: string, type: Parameters<TaskStore["appendEvent"]>[1], payload: Record<string, unknown>): Promise<void> {
    try {
      await this.requireStore().appendEvent(id, type, payload)
    } catch {
      // The run itself carries the authoritative state; a missed note is not fatal.
    }
  }

  private async runTask(id: string, signal: AbortSignal): Promise<void> {
    await this.semaphore.acquire()
    try {
      if (signal.aborted || this.requireTask(id).status === "cancelled") return
      const task = this.requireTask(id)
      if (task.mode === "review") {
        await this.runReview(id, signal)
        return
      }
      // Re-read HEAD at run time: the repository may have moved since the plan was made.
      const baseRevision = await this.git.baseRevision(this.repoRoot)
      await this.requireStore().update(id, (draft) => {
        draft.baseRevision = baseRevision
      })

      try {
        await access(task.worktree)
      } catch (error) {
        if (!isMissingFile(error)) throw error
        await this.git.createWorktree(this.repoRoot, task.worktree, task.branch, baseRevision)
      }
      const initialCheckpoint = await this.git.checkpoint(task.worktree, "cp_initial", "Initial worktree")
      await this.requireStore().update(id, (draft) => {
        draft.checkpoints = [
          { id: initialCheckpoint.id, commit: initialCheckpoint.commit, message: initialCheckpoint.message, createdAt: initialCheckpoint.createdAt },
        ]
      })
      await this.requireStore().appendEvent(id, "checkpoint.created", { checkpointId: initialCheckpoint.id, commit: initialCheckpoint.commit })

      const planChecks = task.plan?.checks ?? []
      const baseline = await this.runVerificationPhase(id, task.worktree, planChecks, signal, "baseline", false)
      await this.requireStore().appendEvent(id, "system.note", {
        message: `Baseline checks: ${JSON.stringify(summarizeChecks(baseline))}`,
      })

      if (planChecks.length === 0) {
        await this.failWithEvidence(id, "verification_unavailable", "No verification command was detected for this repository.", baseline)
        return
      }

      await this.agentLoop(id, task.worktree, baseRevision, signal, null)
      let checks = await this.verify(id, task.worktree, planChecks, signal)

      let repairLoops = 0
      while (checks.some((check) => check.status === "failed") && repairLoops < this.config.limits.maxRepairLoops) {
        if (signal.aborted) return
        repairLoops += 1
        await this.requireStore().update(id, (draft) => {
          assertTransition(draft.status, "acting")
          draft.status = "acting"
        })
        const failure = this.failureReport(checks)
        await this.requireStore().appendEvent(id, "system.note", { message: `Repair loop ${repairLoops}: ${failure.slice(0, 1000)}` })
        await this.agentLoop(id, task.worktree, baseRevision, signal, `Verification failed. Fix the cause using this real output, then call finish.\n\n${failure}`)
        checks = await this.verify(id, task.worktree, planChecks, signal)
      }

      // Recompute the diff from Git itself. Persisted patches can be stale if the
      // agent mutated the worktree through exec after its last write.
      const finalPatches = await this.computePatches(task.worktree, baseRevision)
      await this.requireStore().update(id, (draft) => {
        draft.patches = finalPatches
      })

      const latest = this.requireTask(id)
      const failures = checks.filter((check) => check.status === "failed")
      const passed = checks.filter((check) => check.status === "passed")
      const skippedRequired = checks.filter((check) => check.required && check.status === "skipped")
      const postWriteCheckpoint = latest.checkpoints.some((checkpoint) => checkpoint.id !== "cp_initial")
      const hasEvidence =
        checks.length > 0 &&
        failures.length === 0 &&
        passed.length > 0 &&
        skippedRequired.length === 0 &&
        finalPatches.length > 0 &&
        postWriteCheckpoint

      if (!hasEvidence) {
        const reason =
          failures.length > 0
            ? "check_failed"
            : skippedRequired.length > 0
              ? "verification_skipped"
              : finalPatches.length === 0
                ? "no_changes"
                : "verification_unavailable"
        await this.failWithEvidence(id, reason, this.explainMissingEvidence({ failures, passed, skippedRequired, patches: finalPatches, postWriteCheckpoint }), checks, baseline)
        return
      }

      await this.succeed(id, checks, baseline)
    } finally {
      this.semaphore.release()
    }
  }

  private async runReview(id: string, signal: AbortSignal): Promise<void> {
    const baseRevision = await this.git.baseRevision(this.repoRoot)
    const context: ToolContext = {
      worktree: this.repoRoot,
      baseRevision,
      git: this.git,
      runner: this.runner,
      limits: this.config.limits,
      writesUsed: 0,
      readOnly: true,
      signal,
    }
    const review = await this.reviewLoop(id, baseRevision, signal, context)
    await this.requireStore().update(id, (draft) => {
      assertTransition(draft.status, "verifying")
      draft.status = "verifying"
    })
    await this.requireStore().appendEvent(id, "verification.started", { mode: "review", inspections: review.inspections })
    if (!review.reported || review.fileReads === 0) {
      const reason = !review.reported
        ? "The review finished without calling report_findings."
        : "The review reported findings without reading any file content."
      await this.failWithEvidence(id, "review_incomplete", reason, [], undefined)
      return
    }
    const findings = review
    await this.requireStore().update(id, (draft) => {
      assertTransition(draft.status, "succeeded")
      draft.status = "succeeded"
      draft.findings = findings.findings
      draft.checks = []
      draft.report = buildReport({
        summary: draft.plan?.summary ?? "Read-only review completed.",
        changedFiles: 0,
        additions: 0,
        deletions: 0,
        checks: [],
        risks: draft.plan?.risks ?? [],
        unverified: [
          `Read-only review: ${findings.fileReads} file content read(s), ${findings.searches} search(es), no commands run and no writes.`,
          ...(findings.findings.length === 0 ? ["The review reported no findings; this is a claim from the model, not a verification result."] : []),
        ],
      })
    })
    await this.requireStore().appendEvent(id, "run.succeeded", {
      findings: findings.findings.length,
      fileReads: findings.fileReads,
      searches: findings.searches,
      mode: "review",
    })
  }

  private async reviewLoop(
    id: string,
    baseRevision: string,
    signal: AbortSignal,
    context: ToolContext,
  ): Promise<{ reported: boolean; inspections: number; fileReads: number; searches: number; findings: Finding[] }> {
    const task = this.requireTask(id)
    const plan = task.plan
    if (!plan) throw new RuntimeError(409, "plan_missing", "The task has no plan")
    const system = await this.systemPrompt(task, plan, true)
    const messages: ProviderMessage[] = [
      { role: "system", content: system },
      { role: "user", content: buildUserPrompt(task, plan, this.requireSummary(), true) },
    ]
    let reported = false
    let inspections = 0
    let fileReads = 0
    let searches = 0
    let findings: Finding[] = []
    for (let turn = 0; turn < this.config.limits.maxTurns; turn += 1) {
      if (signal.aborted) throw new CancelledError()
      const response = await this.provider.chat({ system, messages, tools: toolSpecs(true), signal })
      messages.push({ role: "assistant", content: response.text, tool_calls: response.toolCalls })
      if (response.text) await this.requireStore().appendEvent(id, "system.note", { message: response.text.slice(0, 2000) })
      if (response.toolCalls.length === 0) break
      let finished = false
      for (const call of response.toolCalls) {
        const toolCall: ToolCall = { name: call.name, arguments: call.arguments }
        if (call.parseError) {
          messages.push({ role: "tool", tool_call_id: call.id, content: `Invalid JSON arguments: ${call.parseError}` })
          continue
        }
        if (call.name === "finish") {
          finished = true
          break
        }
        await this.requireStore().appendEvent(id, "tool.started", { tool: call.name })
        const result = await executeTool(toolCall, context)
        if (result.ok && INSPECTION_TOOLS.has(call.name)) inspections += 1
        if (result.ok && call.name === "repo_read") fileReads += 1
        if (result.ok && call.name === "repo_search") searches += 1
        await this.requireStore().appendEvent(id, "tool.finished", { tool: call.name, ok: result.ok, error: result.error ?? null })
        if (call.name === "report_findings" && result.ok) {
          findings = parseFindings(result.output)
          reported = true
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result.output).slice(0, 6000) })
      }
      if (finished) break
    }
    return { reported, inspections, fileReads, searches, findings }
  }

  private async agentLoop(id: string, worktree: string, baseRevision: string, signal: AbortSignal, extraUserMessage: string | null): Promise<void> {
    const task = this.requireTask(id)
    const plan = task.plan
    if (!plan) throw new RuntimeError(409, "plan_missing", "The task has no plan")
    const system = await this.systemPrompt(task, plan, false)
    const messages: ProviderMessage[] = [
      { role: "system", content: system },
      { role: "user", content: buildUserPrompt(task, plan, this.requireSummary(), false) },
    ]
    if (extraUserMessage) messages.push({ role: "user", content: extraUserMessage })
    const context: ToolContext = {
      worktree,
      baseRevision,
      git: this.git,
      runner: this.runner,
      limits: this.config.limits,
      writesUsed: task.patches.length,
      readOnly: false,
      signal,
    }
    let finished = false
    for (let turn = 0; turn < this.config.limits.maxTurns; turn += 1) {
      if (signal.aborted) throw new CancelledError()
      const response = await this.provider.chat({ system, messages, tools: toolSpecs(false), signal })
      messages.push({ role: "assistant", content: response.text, tool_calls: response.toolCalls })
      if (response.text) await this.requireStore().appendEvent(id, "system.note", { message: response.text.slice(0, 2000) })
      if (response.toolCalls.length === 0) {
        finished = true
        break
      }
      for (const call of response.toolCalls) {
        if (call.parseError) {
          messages.push({ role: "tool", tool_call_id: call.id, content: `Invalid JSON arguments: ${call.parseError}` })
          continue
        }
        if (call.name === "finish") {
          finished = true
          break
        }
        await this.requireStore().appendEvent(id, "tool.started", { tool: call.name, arguments: summarizeArguments(call.arguments) })
        const result = await executeTool({ name: call.name, arguments: call.arguments }, context)
        const exitCode = extractExitCode(result.output)
        await this.requireStore().appendEvent(id, "tool.finished", {
          tool: call.name,
          ok: result.ok,
          error: result.error ?? null,
          exitCode,
          summary: summarizeToolOutput(result),
        })
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 6000) })
        if (call.name === "repo_write" && result.ok) {
          const checkpoint = await this.git.checkpoint(worktree, `cp_${context.writesUsed}`, `After write ${context.writesUsed}`)
          const patches = await this.computePatches(worktree, baseRevision)
          await this.requireStore().update(id, (draft) => {
            draft.checkpoints = [...draft.checkpoints, { id: checkpoint.id, commit: checkpoint.commit, message: checkpoint.message, createdAt: checkpoint.createdAt }]
            draft.patches = patches
          })
          await this.requireStore().appendEvent(id, "checkpoint.created", { checkpointId: checkpoint.id, commit: checkpoint.commit })
          await this.requireStore().appendEvent(id, "patch.created", { patches })
        }
      }
      if (finished) break
    }
    if (!finished) {
      throw new BudgetError("turns_exhausted", `The agent used all ${this.config.limits.maxTurns} turns without finishing`)
    }
  }

  private async verify(id: string, worktree: string, planChecks: PlanCheck[], signal: AbortSignal): Promise<Check[]> {
    await this.requireStore().update(id, (draft) => {
      assertTransition(draft.status, "verifying")
      draft.status = "verifying"
      draft.checks = planChecks.map((check) => ({ ...check, status: "queued" }))
    })
    await this.requireStore().appendEvent(id, "verification.started", { checks: planChecks.length })
    return this.runVerificationPhase(id, worktree, planChecks, signal, "final", true)
  }

  private async runVerificationPhase(id: string, cwd: string, planChecks: PlanCheck[], signal: AbortSignal, phase: "baseline" | "final", persist: boolean): Promise<Check[]> {
    if (planChecks.length === 0) return []
    return runChecks(planChecks, {
      runner: this.runner,
      cwd,
      limits: this.config.limits,
      signal,
      onStart: async (check) => {
        await this.requireStore().appendEvent(id, "check.started", { phase, checkId: check.id, label: check.label, command: check.command })
      },
      onFinish: async (check) => {
        await this.requireStore().appendEvent(id, "check.finished", {
          phase,
          checkId: check.id,
          label: check.label,
          status: check.status,
          exitCode: check.exitCode ?? null,
          durationMs: check.durationMs ?? 0,
          timedOut: check.timedOut ?? false,
          reason: check.reason ?? null,
        })
        if (persist) {
          await this.requireStore().update(id, (draft) => {
            const existing = draft.checks.findIndex((item) => item.id === check.id)
            if (existing >= 0) draft.checks[existing] = check
            else draft.checks = [...draft.checks, check]
          })
        }
      },
    })
  }

  private async succeed(id: string, checks: Check[], baseline: Check[]): Promise<void> {
    const task = this.requireTask(id)
    const totals = task.patches.reduce(
      (sum, patch) => ({ additions: sum.additions + patch.additions, deletions: sum.deletions + patch.deletions }),
      { additions: 0, deletions: 0 },
    )
    const report = buildReport({
      summary: task.plan?.summary ?? "Task completed.",
      changedFiles: task.patches.length,
      additions: totals.additions,
      deletions: totals.deletions,
      checks,
      baseline,
      risks: task.plan?.risks ?? [],
      unverified: collectUnverified(checks),
    })
    await this.requireStore().update(id, (draft) => {
      assertTransition(draft.status, "succeeded")
      draft.status = "succeeded"
      draft.checks = checks
      draft.report = report
      draft.error = null
      draft.plan = draft.plan ? { ...draft.plan, steps: draft.plan.steps.map((step) => ({ ...step, status: "done" })) } : draft.plan
    })
    await this.requireStore().appendEvent(id, "run.succeeded", { report })
  }

  private async failWithEvidence(id: string, code: string, message: string, checks: Check[], baseline?: Check[]): Promise<void> {
    const task = this.requireTask(id)
    if (task.status === "cancelled") return
    const totals = task.patches.reduce(
      (sum, patch) => ({ additions: sum.additions + patch.additions, deletions: sum.deletions + patch.deletions }),
      { additions: 0, deletions: 0 },
    )
    const report = buildReport({
      summary: message,
      changedFiles: task.patches.length,
      additions: totals.additions,
      deletions: totals.deletions,
      checks,
      baseline,
      risks: task.plan?.risks ?? [],
      unverified: collectUnverified(checks),
    })
    await this.requireStore().update(id, (draft) => {
      draft.status = "failed"
      draft.checks = checks.length > 0 ? checks : draft.checks
      draft.report = report
      draft.error = { code, message }
    })
    await this.requireStore().appendEvent(id, "run.failed", { code, message })
  }

  private async handleRunFailure(id: string, error: unknown): Promise<void> {
    const current = this.requireStore().get(id)
    if (!current) return
    if (current.task.status === "cancelled" || current.task.status === "succeeded") return
    if (error instanceof CancelledError || (error instanceof ProviderError && error.code === "cancelled")) {
      return
    }
    const code = error instanceof ProviderError ? error.code : error instanceof BudgetError ? error.code : "runtime_error"
    const message = error instanceof Error ? error.message : "The run failed"
    const checks = current.task.checks
    await this.failWithEvidence(id, code, message, checks)
  }

  private async computePatches(worktree: string, baseRevision: string): Promise<Patch[]> {
    const changes = await this.git.changedFiles(worktree, baseRevision)
    const statuses = await this.git.nameStatus(worktree, baseRevision)
    return changes.map((change) => {
      const status = statuses.get(change.path)
      return {
        path: change.path,
        oldPath: status?.oldPath,
        kind: status?.kind ?? "modified",
        additions: change.additions,
        deletions: change.deletions,
      }
    })
  }

  private explainMissingEvidence(input: {
    failures: Check[]
    passed: Check[]
    skippedRequired: Check[]
    patches: Patch[]
    postWriteCheckpoint: boolean
  }): string {
    if (input.failures.length > 0) return `${input.failures.length} required check(s) failed.`
    if (input.skippedRequired.length > 0) return "A required check was skipped, so success cannot be claimed."
    if (input.patches.length === 0) return "No repository change was produced."
    if (!input.postWriteCheckpoint) return "No checkpoint was recorded after a write."
    return "Verification evidence is incomplete; success cannot be claimed."
  }

  private failureReport(checks: Check[]): string {
    return checks
      .filter((check) => check.status === "failed")
      .map((check) => `$ ${check.command}\nexit=${check.exitCode ?? "null"}\n${(check.stdout ?? "").slice(-4000)}\n${(check.stderr ?? "").slice(-4000)}`)
      .join("\n\n")
  }

  // ---- 项目（需求包驱动的新建项目）----
  async projects() {
    return listProjects(resolve(this.config.projectsRoot ?? "../../runtime-workspace/projects"))
  }

  async deleteProject(id: string): Promise<void> {
    const root = resolve(this.config.projectsRoot ?? "../../runtime-workspace/projects")
    if (!/^[a-zA-Z0-9._-]+$/.test(id) || id === "." || id === "..") {
      throw new RuntimeError(400, "invalid_project", "项目 id 不合法")
    }
    const target = resolve(root, id)
    if (!target.startsWith(root + (process.platform === "win32" ? "\\" : "/"))) {
      throw new RuntimeError(400, "invalid_project", "项目路径越界")
    }
    if (resolve(this.repoRoot) === target) {
      throw new RuntimeError(409, "project_active", "当前项目正在使用，请先切换到其他项目再删除")
    }
    const requirement = join(target, ".panshi", "requirement.json")
    const exists = await stat(requirement).then(() => true).catch(() => false)
    if (!exists) throw new RuntimeError(404, "project_not_found", "项目不存在或不是 PanShi 项目")
    await rm(target, { recursive: true, force: true })
  }

  async createProject(draft: ProjectDraft) {
    const { path, requirement } = await createProjectDir(resolve(this.config.projectsRoot ?? "../../runtime-workspace/projects"), draft)
    await this.useRepo(path)
    return {
      project: {
        id: path.split(/[\\/]/).pop(),
        path,
        product: requirement.product,
        anchors: requirement.anchors.length,
      },
      repo: this.repoSummary(),
      summary: this.health(),
    }
  }

  // ---- 工厂工段（PanShi-SwarmFactory）----
  /** 工厂运行的取消控制器：与 M1 计划/执行的 active 分开，两者生命周期不同。 */
  private readonly factoryControllers = new Map<string, AbortController>()

  private factory(taskId: string): FactoryPipeline {
    this.requireTask(taskId)
    return new FactoryPipeline({
      taskId,
      runDir: this.requireStore().taskDir(taskId),
      repoRoot: this.repoRoot,
      runner: this.runner,
      git: this.git,
      limits: this.config.limits,
      emit: async (type, payload) => {
        await this.requireStore().appendEvent(taskId, type, payload)
      },
      events: async () => this.events(taskId),
      ai: { enabled: this.aiSource !== "none", provider: this.aiSource !== "none" ? this.provider : null },
      signal: this.factoryControllers.get(taskId)?.signal,
    })
  }

  async factoryStages(taskId: string): Promise<StageRun[]> {
    return this.factory(taskId).listStages()
  }

  async factoryArtifacts(taskId: string): Promise<Awaited<ReturnType<FactoryPipeline["listArtifacts"]>>> {
    return this.factory(taskId).listArtifacts()
  }

  async factoryArtifact(taskId: string, artifactId: string) {
    return this.factory(taskId).store.readArtifact(artifactId)
  }

  async factoryContracts(taskId: string): Promise<ContractBundle | null> {
    const path = join(this.requireStore().taskDir(taskId), "contracts", "bundle.json")
    try {
      const raw = await readFile(path, "utf8")
      return JSON.parse(raw) as ContractBundle
    } catch {
      return null
    }
  }

  async runFactoryStage(taskId: string, stage: number, confirm: boolean): Promise<StageRun> {
    const controller = this.beginFactoryRun(taskId)
    try {
      const run = await this.factory(taskId).runStage(stage, { confirm })
      await this.refreshFactoryState(taskId)
      return run
    } finally {
      this.endFactoryRun(taskId, controller)
    }
  }

  async runFactoryAll(taskId: string, confirm: boolean): Promise<StageRun[]> {
    const controller = this.beginFactoryRun(taskId)
    try {
      const runs = await this.factory(taskId).runAll({ confirm })
      await this.refreshFactoryState(taskId)
      return runs
    } finally {
      this.endFactoryRun(taskId, controller)
    }
  }

  /** 当前任务是否被别的进程持锁（用于界面显示排队状态）。 */
  async factoryLock(taskId: string) {
    return peekTaskLock(this.requireStore().taskDir(taskId))
  }

  /** 取消正在跑的工厂任务。没有在跑时返回 false。 */
  cancelFactory(taskId: string): boolean {
    const controller = this.factoryControllers.get(taskId)
    if (!controller) return false
    controller.abort()
    return true
  }

  private beginFactoryRun(taskId: string): AbortController {
    const existing = this.factoryControllers.get(taskId)
    // 复用未中止的 controller，避免上一次的 signal 被这次覆盖后仍在使用
    if (existing && !existing.signal.aborted) return existing
    const controller = new AbortController()
    this.factoryControllers.set(taskId, controller)
    return controller
  }

  private endFactoryRun(taskId: string, controller: AbortController): void {
    // 只有仍然是当前 controller 时才清理，避免误删后一次运行注册的
    if (this.factoryControllers.get(taskId) === controller) {
      this.factoryControllers.delete(taskId)
    }
  }

  /** 工厂运行状态独立于 M1 计划审批：由十工段的 StageRun 推导。 */
  async factoryState(taskId: string): Promise<FactoryState | undefined> {
    try {
      return summarizeFactory(await this.factory(taskId).listStages())
    } catch {
      return undefined
    }
  }

  async refreshFactoryState(taskId: string): Promise<void> {
    const state = await this.factoryState(taskId)
    if (!state) return
    try {
      await this.requireStore().update(taskId, (draft) => {
        draft.factory = state
      })
    } catch {
      // 任务不可写时不影响工段返回
    }
  }

  private requireStore(): TaskStore {
    if (!this.store) throw new RuntimeError(409, "repo_unavailable", this.repoError ?? "No repository is configured")
    return this.store
  }

  private requireSummary(): RepoSummary {
    if (!this.summary) throw new RuntimeError(409, "repo_unavailable", this.repoError ?? "No repository summary is available")
    return this.summary
  }

  private requireTask(id: string): Task {
    const record = this.requireStore().get(id)
    if (!record) throw new RuntimeError(404, "not_found", `Unknown task: ${id}`)
    return record.task
  }
}

const INSPECTION_TOOLS = new Set(["repo_read", "repo_search", "repo_list", "git_diff", "git_status", "repo_write", "exec"])

/** Diffs are computed lazily per file; beyond this the client is told so explicitly. */
const MAX_DIFF_FILES = 50

function parseFindings(output: unknown): Finding[] {
  const value = output as { findings?: unknown }
  if (!Array.isArray(value?.findings)) return []
  const findings: Finding[] = []
  for (const [index, item] of value.findings.slice(0, 50).entries()) {
    const parsed = FindingSchema.safeParse({
      id: `finding_${index + 1}`,
      severity: (item as { severity?: unknown })?.severity ?? "medium",
      title: (item as { title?: unknown })?.title ?? "Untitled finding",
      path: (item as { path?: unknown })?.path ?? "unknown",
      line: (item as { line?: unknown })?.line ?? 0,
      detail: (item as { detail?: unknown })?.detail ?? "",
      status: "open",
    })
    if (parsed.success) findings.push(parsed.data)
  }
  return findings
}

function summarizeArguments(args: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key === "content") {
      summary.bytes = typeof value === "string" ? Buffer.byteLength(value, "utf8") : 0
    } else if (typeof value === "string") {
      summary[key] = value.slice(0, 300)
    } else {
      summary[key] = value
    }
  }
  return summary
}

function summarizeToolOutput(result: { ok: boolean; output: unknown }): string {
  if (!result.ok) return "failed"
  const output = result.output as { exitCode?: number; status?: string; path?: string; matches?: unknown[]; entries?: unknown[] } | null
  if (output && typeof output === "object") {
    if (typeof output.exitCode === "number") return `exit=${output.exitCode}`
    if (typeof output.path === "string") return output.path
    if (Array.isArray(output.matches)) return `${output.matches.length} matches`
    if (Array.isArray(output.entries)) return `${output.entries.length} entries`
  }
  return result.ok ? "ok" : "failed"
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function extractExitCode(output: unknown): number | null {
  if (output && typeof output === "object" && "exitCode" in output) {
    const value = (output as { exitCode?: unknown }).exitCode
    return typeof value === "number" ? value : null
  }
  return null
}

function toolSpecs(review: boolean): ToolSpec[] {
  const specs: ToolSpec[] = [
    {
      name: "repo_list",
      description: "List repository files and directories. Paths are repository-relative.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, depth: { type: "number" } },
      },
    },
    {
      name: "repo_search",
      description: "Search file contents with ripgrep. Returns path, line and text.",
      parameters: {
        type: "object",
        properties: { pattern: { type: "string" }, glob: { type: "string" } },
        required: ["pattern"],
      },
    },
    {
      name: "repo_read",
      description: "Read a text file. Returns content and line metadata.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, startLine: { type: "number" }, endLine: { type: "number" } },
        required: ["path"],
      },
    },
    {
      name: "git_status",
      description: "Show the worktree status.",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "git_diff",
      description: "Show the diff against the base revision, optionally for one path.",
      parameters: { type: "object", properties: { path: { type: "string" } } },
    },
  ]
  if (review) {
    specs.push({
      name: "report_findings",
      description: "Report read-only review findings. Call this before finish; an empty array is valid.",
      parameters: {
        type: "object",
        properties: {
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                severity: { type: "string", enum: ["critical", "high", "medium", "low", "info"] },
                title: { type: "string" },
                path: { type: "string" },
                line: { type: "number" },
                detail: { type: "string" },
              },
              required: ["severity", "title", "path", "line", "detail"],
            },
          },
        },
        required: ["findings"],
      },
    })
  } else {
    specs.push({
      name: "repo_write",
      description: "Write a complete file inside the worktree. Provide the full content.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" }, baseHash: { type: "string" } },
        required: ["path", "content"],
      },
    })
    specs.push({
      name: "exec",
      description: "Run one allowlisted command in the worktree. Returns exit code and output.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" }, args: { type: "array", items: { type: "string" } } },
        required: ["command"],
      },
    })
  }
  specs.push({
    name: "finish",
    description: "Signal that implementation is complete so the runtime can run verification.",
    parameters: { type: "object", properties: { summary: { type: "string" } } },
  })
  return specs
}

function buildSystemPrompt(task: Task, plan: Plan, repo: RepoSummary, limits: Limits, review: boolean): string {
  return [
    "You are RepoPilot Lite, a local coding agent working inside an isolated Git worktree.",
    review
      ? "This is a READ-ONLY review. Do not modify files. Inspect the repository, then call report_findings with concrete findings (path, line, severity, detail) and finish."
      : "Use tools to inspect and modify the repository. Keep changes minimal and inside the approved plan.",
    "Never claim a command ran unless you called exec. The runtime runs verification commands itself after you call finish.",
    `Repository: ${repo.name} (${repo.root})`,
    `Languages: ${repo.languages.join(", ") || "unknown"}; package manager: ${repo.packageManager}`,
    `Base revision: ${repo.baseRevision ?? "unknown"}`,
    `Approved plan: ${plan.summary}`,
    `Plan steps: ${plan.steps.map((step) => step.title).join(" | ")}`,
    `Planned files: ${plan.files.map((file) => file.path).join(", ") || "none"}`,
    `Verification commands: ${plan.checks.map((check) => `${check.label}: ${check.command}`).join(" | ") || "none detected"}`,
    `Limits: ${limits.maxTurns} model turns, ${limits.maxWrites} file writes, ${limits.commandTimeoutMs}ms per command, ${limits.maxWallMs}ms wall clock.`,
    `Task mode: ${task.mode}`,
  ].join("\n")
}

function buildUserPrompt(task: Task, plan: Plan, repo: RepoSummary, review: boolean): string {
  return [
    `Task: ${task.title}`,
    `Goal and constraints: ${task.summary || "(none provided)"}`,
    `Plan summary: ${plan.summary}`,
    review
      ? "Inspect the current changes and report findings with report_findings."
      : "Implement the plan in the worktree. When the change is complete, call finish.",
    `Tracked scripts: ${JSON.stringify(repo.scripts)}`,
  ].join("\n")
}
