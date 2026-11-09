import { resolve } from "node:path"
import type { AgentEvent, Task, TaskMode } from "../shared/types.ts"
import { loadConfig } from "../server/core/config.ts"
import { createProvider } from "../server/core/provider-factory.ts"
import { Runtime } from "../server/core/runtime.ts"

loadEnvFiles()

type Flags = {
  repo?: string
  summary: string
  mode: TaskMode
  yes: boolean
  json: boolean
  follow: boolean
  checkpoint?: string
  base?: string
}

const HELP = `RepoPilot Lite CLI

Usage:
  repo-agent plan "<title>" [--summary text] [--mode generate|fix|review] [--repo path] [--json]
  repo-agent run "<title>" [--summary text] [--mode ...] [--repo path] [--yes] [--json]
  repo-agent status <taskId> [--follow] [--json] [--repo path]
  repo-agent diff <taskId> [--repo path] [--json]
  repo-agent undo <taskId> [--checkpoint id] [--repo path]
  repo-agent review [--repo path] [--json]

Exit codes: 0 success, 1 failure, 3 waiting for approval.
The runtime never reports success unless a real check passed.`

const [command = "help", ...rest] = process.argv.slice(2)
const { positional, flags } = parseArgs(rest)

if (command === "help" || command === "--help" || command === "-h") {
  console.log(HELP)
  process.exit(0)
}

const config = loadConfig({ repo: flags.repo })
// The CLI must never reconcile: a server may be executing these tasks right now.
const runtime = new Runtime({ config, provider: createProvider(config), reconcileInterrupted: false })
await runtime.init()

if (!runtime.repoReady()) {
  console.error(`Repository is not ready: ${runtime.repoFailure() ?? "unknown error"}`)
  console.error("Run `pnpm demo:repo` to create the demo repository, or pass --repo=<path>.")
  process.exit(1)
}

try {
  if (command === "plan") {
    const task = await createTask(runtime, positional.join(" ").trim(), flags)
    await runtime.waitForTask(task.id)
    const finished = runtime.getTask(task.id)
    printTask(finished, flags.json)
    process.exit(finished.status === "awaiting_approval" ? 0 : 1)
  }

  if (command === "run") {
    const task = await createTask(runtime, positional.join(" ").trim(), flags)
    await runtime.waitForTask(task.id)
    let current = runtime.getTask(task.id)
    if (current.status === "awaiting_approval" && !flags.yes) {
      printTask(current, flags.json)
      console.error("Plan is ready. Re-run with --yes to approve and execute.")
      process.exit(3)
    }
    if (current.status === "awaiting_approval") {
      await runtime.approve(current.id, current.plan?.hash)
    }
    await runtime.waitForTask(current.id)
    current = runtime.getTask(current.id)
    printTask(current, flags.json)
    process.exit(exitCodeForTask(current))
  }

  if (command === "review") {
    const task = await createTask(runtime, positional.join(" ").trim() || "Review the current changes", { ...flags, mode: "review" })
    await runtime.waitForTask(task.id)
    let current = runtime.getTask(task.id)
    if (current.status === "awaiting_approval") {
      await runtime.approve(current.id, current.plan?.hash)
      await runtime.waitForTask(current.id)
      current = runtime.getTask(current.id)
    }
    printTask(current, flags.json)
    process.exit(exitCodeForTask(current))
  }

  if (command === "status") {
    const id = positional[0]
    if (!id) throw new Error("status requires a task id")
    await runtime.refreshTask(id)
    if (flags.follow) {
      await follow(runtime, id, flags.json)
    }
    let current = await runtime.refreshTask(id)
    if (current.status !== "succeeded" && current.status !== "failed" && current.status !== "cancelled") {
      await runtime.waitForTask(id).catch(() => undefined)
      current = await runtime.refreshTask(id)
    }
    printTask(current, flags.json)
    process.exit(exitCodeForTask(current))
  }

  if (command === "diff") {
    const id = positional[0]
    if (!id) throw new Error("diff requires a task id")
    await runtime.refreshTask(id)
    const result = await runtime.diff(id)
    if (flags.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      if (result.patches.length === 0) console.log("No changes recorded.")
      for (const patch of result.patches) {
        console.log(`\n=== ${patch.kind} ${patch.path} (+${patch.additions} -${patch.deletions}) ===`)
        console.log(result.diff[patch.path] ?? "(diff unavailable)")
      }
    }
    process.exit(0)
  }

  if (command === "undo") {
    const id = positional[0]
    if (!id) throw new Error("undo requires a task id")
    await runtime.refreshTask(id)
    const task = await runtime.undo(id, flags.checkpoint)
    printTask(task, flags.json)
    process.exit(0)
  }

  console.error(`Unknown command: ${command}`)
  console.error(HELP)
  process.exit(1)
} catch (error) {
  const message = error instanceof Error ? error.message : "Command failed"
  console.error(message)
  process.exit(1)
}

async function createTask(runtime: Runtime, title: string, flags: Flags): Promise<Task> {
  if (!title) throw new Error("A task title is required")
  return runtime.createTask({ title, summary: flags.summary, mode: flags.mode })
}

async function follow(runtime: Runtime, id: string, json: boolean): Promise<void> {
  let cursor = 0
  for (;;) {
    const events = await runtime.events(id, cursor)
    for (const event of events) {
      cursor = Math.max(cursor, event.seq)
      if (json) console.log(JSON.stringify({ type: "event", event }))
      else printEvent(event)
    }
    const task = await runtime.refreshTask(id)
    if (task.status === "succeeded" || task.status === "failed" || task.status === "cancelled") return
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
}

function printEvent(event: AgentEvent): void {
  const payload = event.payload as Record<string, unknown>
  const detail =
    event.type === "tool.finished"
      ? `tool=${payload.tool} ok=${payload.ok}${payload.exitCode !== undefined && payload.exitCode !== null ? ` exit=${payload.exitCode}` : ""}`
      : event.type === "check.finished"
        ? `check=${payload.label} status=${payload.status}${payload.exitCode !== undefined && payload.exitCode !== null ? ` exit=${payload.exitCode}` : ""}`
        : event.type === "plan.ready"
          ? `plan=${(payload.plan as { summary?: string } | undefined)?.summary ?? ""}`
          : event.type === "run.failed"
            ? `${payload.code}: ${payload.message}`
            : event.type === "run.succeeded"
              ? "verification passed"
              : ""
  console.log(`[${String(event.seq).padStart(3, "0")}] ${event.type.padEnd(22)} ${detail}`)
}

function printTask(task: Task, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ type: "task", task }, null, 2))
    return
  }
  console.log(`\nTask ${task.id}  [${task.status}]  ${task.title}`)
  console.log(`mode=${task.mode} repo=${task.repo}`)
  if (task.plan) {
    console.log(`\nPlan (${task.plan.hash}): ${task.plan.summary}`)
    for (const step of task.plan.steps) console.log(`  - ${step.title}: ${step.detail}`)
    console.log("Verification commands:")
    for (const check of task.plan.checks) console.log(`  $ ${check.command}  (${check.label})`)
  }
  if (task.checks.length > 0) {
    console.log("\nChecks:")
    for (const check of task.checks) {
      const exit = check.exitCode === null || check.exitCode === undefined ? "n/a" : String(check.exitCode)
      console.log(`  ${symbol(check.status)} ${check.label}: ${check.status} exit=${exit} ${check.durationMs ?? 0}ms${check.reason ? ` (${check.reason})` : ""}`)
    }
  }
  if (task.findings.length > 0) {
    console.log("\nFindings:")
    for (const finding of task.findings) {
      console.log(`  [${finding.severity}] ${finding.path}:${finding.line} ${finding.title}`)
    }
  }
  if (task.patches.length > 0) {
    console.log("\nChanges:")
    for (const patch of task.patches) console.log(`  ${patch.kind} ${patch.path} (+${patch.additions} -${patch.deletions})`)
  }
  if (task.report) {
    const report = task.report
    console.log(`\nReport: ${report.summary}`)
    console.log(`  files=${report.changedFiles} +${report.additions} -${report.deletions}`)
    console.log(`  checks: passed=${report.checks.passed} failed=${report.checks.failed} skipped=${report.checks.skipped}`)
    for (const item of report.unverified) console.log(`  unverified: ${item}`)
    for (const risk of report.risks) console.log(`  risk: ${risk}`)
  }
  if (task.error) console.log(`\nError (${task.error.code}): ${task.error.message}`)
  if (task.checkpoints.length > 0) {
    console.log(`\nCheckpoints: ${task.checkpoints.map((checkpoint) => checkpoint.id).join(", ")}`)
  }
}

function symbol(status: string): string {
  if (status === "passed") return "✓"
  if (status === "failed") return "✗"
  if (status === "skipped") return "-"
  if (status === "running") return "…"
  return "·"
}

function exitCodeForTask(task: Task): number {
  if (task.status === "succeeded") return 0
  if (task.status === "awaiting_approval" || task.status === "planning" || task.status === "blocked" || task.status === "queued") return 3
  return 1
}

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = []
  const flags: Flags = { summary: "", mode: "generate", yes: false, json: false, follow: false }
  for (const entry of argv) {
    if (entry === "--yes" || entry === "-y") flags.yes = true
    else if (entry === "--json") flags.json = true
    else if (entry === "--follow") flags.follow = true
    else if (entry.startsWith("--repo=")) flags.repo = entry.slice("--repo=".length)
    else if (entry.startsWith("--summary=")) flags.summary = entry.slice("--summary=".length)
    else if (entry.startsWith("--mode=")) flags.mode = normalizeMode(entry.slice("--mode=".length))
    else if (entry.startsWith("--checkpoint=")) flags.checkpoint = entry.slice("--checkpoint=".length)
    else if (entry.startsWith("--base=")) flags.base = entry.slice("--base=".length)
    else positional.push(entry)
  }
  return { positional, flags }
}

function normalizeMode(value: string): TaskMode {
  if (value === "generate" || value === "fix" || value === "review") return value
  throw new Error(`Unknown mode: ${value}`)
}

function loadEnvFiles(): void {
  const candidates = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../../.env.local"),
    resolve(import.meta.dirname, "../.env.local"),
    resolve(import.meta.dirname, "../../.env.local"),
    resolve(import.meta.dirname, "../../../.env.local"),
  ]
  for (const candidate of candidates) {
    try {
      process.loadEnvFile(candidate)
    } catch {
      // Missing env files are expected.
    }
  }
}
