import type { RepoSummary, TaskMode } from "../../shared/types.ts"
import { DEMO_FIXED_SOURCE, DEMO_PLAN } from "./demo-content.ts"

export type ProviderMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  tool_call_id?: string
  tool_calls?: ProviderToolCall[]
}

export type ProviderToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
  parseError?: string
}

export type ProviderTurn = {
  text: string
  toolCalls: ProviderToolCall[]
  finishReason?: string
}

export type PlanDraft = {
  summary: string
  steps: Array<{ title: string; detail: string }>
  files: Array<{ path: string; reason: string }>
  risks: string[]
}

export type PlanRequest = {
  task: { title: string; summary: string; mode: TaskMode }
  repo: RepoSummary
  fileList: string[]
}

export type ToolSpec = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ChatRequest = {
  system: string
  messages: ProviderMessage[]
  tools: ToolSpec[]
  signal?: AbortSignal
  jsonMode?: boolean
}

export interface Provider {
  readonly name: string
  readonly model: string
  plan(request: PlanRequest): Promise<PlanDraft>
  chat(request: ChatRequest): Promise<ProviderTurn>
}

export class ProviderError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "ProviderError"
    this.code = code
  }
}

export type HttpProviderOptions = {
  name: string
  baseUrl: string
  model: string
  apiKey: string
  timeoutMs?: number
}

export class HttpProvider implements Provider {
  readonly name: string
  readonly model: string
  private baseUrl: string
  private apiKey: string
  private timeoutMs: number

  constructor(options: HttpProviderOptions) {
    this.name = options.name
    this.model = options.model
    this.baseUrl = options.baseUrl
    this.apiKey = options.apiKey
    this.timeoutMs = options.timeoutMs ?? 60_000
  }

  async plan(request: PlanRequest): Promise<PlanDraft> {
    const prompt = buildPlanPrompt(request)
    const content = await this.completeJson([
      { role: "system", content: PLAN_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ])
    return parsePlanDraft(content)
  }

  async chat(request: ChatRequest): Promise<ProviderTurn> {
    const payload: Record<string, unknown> = {
      model: this.model,
      temperature: 0.2,
      max_tokens: 2400,
      messages: [
        ...(request.system ? [{ role: "system", content: request.system }] : []),
        ...request.messages.map(toWireMessage),
      ],
      ...(request.tools.length > 0 ? {
        tools: request.tools.map((tool) => ({
          type: "function",
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
        tool_choice: "auto",
      } : {}),
      ...(request.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }
    const body = await this.request(payload, request.signal)
    const message = body.choices?.[0]?.message
    if (!message) throw new ProviderError("model_protocol", "Provider returned no message")
    const toolCalls: ProviderToolCall[] = []
    for (const call of message.tool_calls ?? []) {
      const name = call.function?.name ?? ""
      const raw = call.function?.arguments ?? "{}"
      try {
        const parsed = JSON.parse(raw) as unknown
        toolCalls.push({
          id: call.id ?? `call_${toolCalls.length}`,
          name,
          arguments: typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {},
        })
      } catch {
        toolCalls.push({ id: call.id ?? `call_${toolCalls.length}`, name, arguments: {}, parseError: raw.slice(0, 500) })
      }
    }
    return { text: message.content ?? "", toolCalls, finishReason: body.choices?.[0]?.finish_reason }
  }

  private async completeJson(messages: ProviderMessage[]): Promise<string> {
    const body = await this.request(
      {
        model: this.model,
        temperature: 0.1,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: messages.map(toWireMessage),
      },
      undefined,
    )
    return body.choices?.[0]?.message?.content ?? ""
  }

  private async request(payload: Record<string, unknown>, externalSignal?: AbortSignal): Promise<CompletionResponse> {
    if (!this.apiKey) throw new ProviderError("provider_unconfigured", "No API key is configured")
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const timeout = AbortSignal.timeout(this.timeoutMs)
      const signal = externalSignal ? AbortSignal.any([timeout, externalSignal]) : timeout
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal,
        })
        if (response.status >= 500) {
          lastError = new ProviderError("provider_error", `Provider responded ${response.status}`)
          await delay(400 * (attempt + 1))
          continue
        }
        if (!response.ok) {
          const text = await response.text().catch(() => "")
          throw new ProviderError("provider_error", `Provider responded ${response.status}: ${text.slice(0, 300)}`)
        }
        return (await response.json()) as CompletionResponse
      } catch (error) {
        if (error instanceof ProviderError) {
          if (error.code === "provider_error" && attempt < 2) {
            lastError = error
            await delay(400 * (attempt + 1))
            continue
          }
          throw error
        }
        if (isAbortError(error)) {
          if (externalSignal?.aborted) throw new ProviderError("cancelled", "The run was cancelled")
          throw new ProviderError("provider_timeout", `Provider call timed out after ${this.timeoutMs}ms`)
        }
        lastError = error
        await delay(400 * (attempt + 1))
      }
    }
    throw new ProviderError("provider_error", lastError instanceof Error ? lastError.message : "Provider request failed")
  }
}

export class FakeProvider implements Provider {
  readonly name = "fake"
  readonly model = "fake-deterministic"
  private turns: ProviderTurn[]
  private planDraft: PlanDraft
  private factory?: () => ProviderTurn[]

  constructor(options: { plan?: PlanDraft; turns?: ProviderTurn[]; turnsFactory?: () => ProviderTurn[] } = {}) {
    this.planDraft = options.plan ?? DEMO_PLAN
    this.factory = options.turnsFactory
    this.turns = [...(options.turns ?? options.turnsFactory?.() ?? [])]
  }

  async plan(): Promise<PlanDraft> {
    return this.planDraft
  }

  async chat(): Promise<ProviderTurn> {
    if (this.turns.length === 0 && this.factory) this.turns = [...this.factory()]
    const next = this.turns.shift()
    return next ?? { text: "No further actions.", toolCalls: [] }
  }
}

export function createDemoFakeProvider(): FakeProvider {
  return new FakeProvider({
    turnsFactory: () => [
      {
        text: "I will fix the failing addition test.",
        toolCalls: [
          {
            id: "call_demo_write",
            name: "repo_write",
            arguments: { path: "src/calculator.mjs", content: DEMO_FIXED_SOURCE },
          },
        ],
      },
      {
        text: "The source is fixed. Finishing so checks can run.",
        toolCalls: [{ id: "call_demo_finish", name: "finish", arguments: { summary: "Fixed add()" } }],
      },
    ],
  })
}

const PLAN_SYSTEM_PROMPT = `You plan small, verifiable code changes in a local Git repository.
Return JSON only, no markdown fences, with this exact shape:
{"summary": string, "steps": [{"title": string, "detail": string}], "files": [{"path": string, "reason": string}], "risks": [string]}
Rules:
- At most 6 steps and 4 files.
- Paths are repository-relative and must not contain "..", be absolute, or touch .git, .env, keys, or credentials.
- Do not claim a command ran or a test passed. The runtime runs checks itself.
- If the task is a read-only review, return "files": [] and steps that describe inspection only.`

function buildPlanPrompt(request: PlanRequest): string {
  const { task, repo, fileList } = request
  return [
    `Task mode: ${task.mode}`,
    `Task: ${task.title}`,
    `Goal and constraints: ${task.summary || "(none provided)"}`,
    `Repository: ${repo.name} (${repo.root})`,
    `Languages: ${repo.languages.join(", ") || "unknown"}`,
    `Package manager: ${repo.packageManager}`,
    `Scripts: ${JSON.stringify(repo.scripts)}`,
    `Entrypoints: ${repo.entrypoints.join(", ") || "unknown"}`,
    `Base revision: ${repo.baseRevision ?? "none"}`,
    `Tracked files (first ${fileList.length}):`,
    fileList.slice(0, 200).join("\n"),
  ].join("\n")
}

type WireMessage = {
  role: string
  content: string
  tool_call_id?: string
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>
}

function toWireMessage(message: ProviderMessage): WireMessage {
  const wire: WireMessage = { role: message.role, content: message.content }
  if (message.tool_call_id) wire.tool_call_id = message.tool_call_id
  if (message.tool_calls && message.tool_calls.length > 0) {
    wire.tool_calls = message.tool_calls.map((call) => ({
      id: call.id,
      type: "function",
      function: { name: call.name, arguments: JSON.stringify(call.arguments) },
    }))
  }
  return wire
}

type CompletionResponse = {
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>
    }
  }>
}

function parsePlanDraft(content: string): PlanDraft {
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new ProviderError("model_protocol", "The planner did not return valid JSON")
  }
  const value = parsed as Partial<PlanDraft>
  const steps = Array.isArray(value.steps)
    ? value.steps
        .filter((step): step is { title: string; detail: string } => Boolean(step && typeof step.title === "string"))
        .slice(0, 6)
        .map((step) => ({ title: step.title.slice(0, 200), detail: String(step.detail ?? "").slice(0, 500) }))
    : []
  const files = Array.isArray(value.files)
    ? value.files
        .filter((file): file is { path: string; reason: string } => Boolean(file && typeof file.path === "string"))
        .slice(0, 4)
        .map((file) => ({ path: file.path.slice(0, 300), reason: String(file.reason ?? "").slice(0, 300) }))
    : []
  const risks = Array.isArray(value.risks) ? value.risks.filter((risk): risk is string => typeof risk === "string").slice(0, 6) : []
  return {
    summary: typeof value.summary === "string" ? value.summary.slice(0, 1000) : "",
    steps,
    files,
    risks,
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError"
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}
