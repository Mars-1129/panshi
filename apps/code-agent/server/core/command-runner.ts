import { spawnSync } from "node:child_process"
import type { ChildProcess } from "node:child_process"
import crossSpawn from "cross-spawn"

export type CommandResult = {
  command: string
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
  truncated: boolean
  blocked?: string
}

export type RunCommandInput = {
  command: string
  args?: string[]
  cwd: string
  timeoutMs?: number
  maxOutputBytes?: number
  signal?: AbortSignal
  /**
   * Runtime-owned plumbing (worktree add/reset, checkpoint commits, diff).
   * Only the Git wrapper sets this; model-driven commands always go through policy.
   */
  internal?: boolean
}

const ALLOWED_COMMANDS = new Set([
  "node",
  "npm",
  "pnpm",
  "npx",
  "yarn",
  "git",
  "rg",
  "python",
  "python3",
  "pytest",
  "go",
  "cargo",
  "dotnet",
  "java",
  "mvn",
  "gradle",
  "make",
  "cmake",
  "tsc",
  "vitest",
  "jest",
  "eslint",
  "prettier",
  "biome",
  "ruff",
  "uv",
])

const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "npx", "yarn"])

export function commandDisplay(command: string, args: string[]): string {
  return [command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ")
}

export function checkCommandPolicy(command: string, args: string[]): string | null {
  const executable = command.replace(/\.(exe|cmd|bat)$/i, "").toLowerCase()
  if (!ALLOWED_COMMANDS.has(executable)) {
    return `Command is not in the local allowlist: ${command}`
  }
  const lowered = args.map((arg) => arg.toLowerCase())
  if (executable === "git") {
    // `-c alias.x=!cmd` and `-c core.fsmonitor=!cmd` execute arbitrary programs.
    if (args.some((arg) => arg.includes("!") || arg.includes("\n"))) {
      return "git arguments may not contain shell escapes"
    }
    const subcommand = lowered.find((arg) => !arg.startsWith("-") && !arg.includes("="))
    if (subcommand && ["push", "deploy", "remote", "clean", "filter-branch", "submodule"].includes(subcommand)) {
      return `git ${subcommand} is not allowed in this runtime`
    }
    if (subcommand === "reset" && lowered.includes("--hard")) {
      return "git reset --hard would erase the run's own evidence"
    }
    if (subcommand === "checkout" && (lowered.includes("-f") || lowered.includes("--force"))) {
      return "forced git checkout is not allowed in this runtime"
    }
  }
  if (executable === "rg" && args.some((arg) => arg === "--pre" || arg.startsWith("--pre="))) {
    return "rg --pre would execute an arbitrary program"
  }
  if (executable === "npx") {
    return "npx would download and execute an arbitrary package"
  }
  if (PACKAGE_MANAGERS.has(executable)) {
    const blockedVerbs = ["install", "i", "add", "ci", "publish", "release", "deploy", "dlx", "exec", "rebuild", "link", "unlink", "update", "up"]
    if (lowered.some((arg) => blockedVerbs.includes(arg))) {
      return "Dependency installation, execution and publishing are not allowed in this runtime"
    }
  }
  if (lowered.some((arg) => ["--registry", "--preid", "--otp"].includes(arg))) {
    return "Registry and publishing flags are not allowed"
  }
  if (lowered.some((arg) => arg.includes("&&") || arg.includes("||") || arg.includes(";"))) {
    return "Shell composition is not allowed; run one command at a time"
  }
  return null
}

export class CommandRunner {
  private active = new Set<ChildProcess>()

  async run(input: RunCommandInput): Promise<CommandResult> {
    const args = input.args ?? []
    const display = commandDisplay(input.command, args)
    const blocked = input.internal ? null : checkCommandPolicy(input.command, args)
    if (blocked) {
      return { command: display, exitCode: null, stdout: "", stderr: "", durationMs: 0, timedOut: false, truncated: false, blocked }
    }

    const started = Date.now()
    const timeoutMs = input.timeoutMs ?? 120_000
    const maxOutputBytes = input.maxOutputBytes ?? 64 * 1024

    return new Promise<CommandResult>((resolvePromise) => {
      const child = crossSpawn(input.command, args, {
        cwd: input.cwd,
        env: scrubbedEnv(),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      })
      this.active.add(child)

      let stdout = ""
      let stderr = ""
      let stdoutBytes = 0
      let stderrBytes = 0
      let truncated = false
      let timedOut = false
      let settled = false
      let timer: NodeJS.Timeout | undefined

      const append = (current: string, currentBytes: number, chunk: Buffer): { value: string; bytes: number } => {
        if (currentBytes >= maxOutputBytes) {
          truncated = true
          return { value: current, bytes: currentBytes }
        }
        const remaining = maxOutputBytes - currentBytes
        const slice = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk
        if (chunk.byteLength > remaining) truncated = true
        return { value: current + slice.toString("utf8"), bytes: currentBytes + slice.byteLength }
      }

      child.stdout?.on("data", (chunk: Buffer) => {
        const next = append(stdout, stdoutBytes, chunk)
        stdout = next.value
        stdoutBytes = next.bytes
      })
      child.stderr?.on("data", (chunk: Buffer) => {
        const next = append(stderr, stderrBytes, chunk)
        stderr = next.value
        stderrBytes = next.bytes
      })

      const finish = (exitCode: number | null, errorMessage?: string): void => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        input.signal?.removeEventListener("abort", onAbort)
        this.active.delete(child)
        if (errorMessage) {
          stderr = stderr ? `${stderr}\n${errorMessage}` : errorMessage
        }
        resolvePromise({
          command: display,
          exitCode,
          stdout,
          stderr,
          durationMs: Date.now() - started,
          timedOut,
          truncated,
        })
      }

      const kill = (): void => {
        if (child.pid) killProcessTree(child.pid)
      }

      const onAbort = (): void => {
        kill()
        finish(null, "Command cancelled")
      }

      timer = setTimeout(() => {
        timedOut = true
        kill()
        finish(null, `Command timed out after ${timeoutMs}ms`)
      }, timeoutMs)

      if (input.signal) {
        if (input.signal.aborted) {
          onAbort()
        } else {
          input.signal.addEventListener("abort", onAbort, { once: true })
        }
      }

      child.on("error", (error: Error) => finish(null, error.message))
      child.on("close", (code: number | null) => finish(code))
    })
  }

  cancelAll(): void {
    // Only used during process shutdown. Per-run cancellation goes through AbortSignal
    // so one task's cancel cannot kill another task's command.
    for (const child of this.active) {
      if (child.pid) killProcessTree(child.pid)
      child.kill("SIGKILL")
    }
    this.active.clear()
  }
}

function scrubbedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (/(API_KEY|APIKEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|_KEY$|^KEY$|PRIVATE_KEY|ACCESS_KEY|SESSION_KEY)/i.test(key)) continue
    env[key] = value
  }
  env.CI = "1"
  env.NO_COLOR = "1"
  env.FORCE_COLOR = "0"
  return env
}

export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true })
    return
  }
  try {
    process.kill(pid, "SIGKILL")
  } catch {
    // The process may already be gone.
  }
}
