import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CommandRunner, checkCommandPolicy } from "../../server/core/command-runner.ts"

describe("command policy", () => {
  it.each([
    [["git", "push", "origin", "main"]],
    [["npm", "install"]],
    [["pnpm", "add", "left-pad"]],
    [["pip", "install", "requests"]],
    [["node", "-e", "x && y"]],
    [["curl", "https://example.com"]],
  ])("blocks %j", (args) => {
    expect(checkCommandPolicy(args[0] as string, args.slice(1) as string[])).not.toBeNull()
  })

  it("allows read-only and test commands", () => {
    expect(checkCommandPolicy("npm", ["run", "test"])).toBeNull()
    expect(checkCommandPolicy("git", ["status", "--porcelain"])).toBeNull()
    expect(checkCommandPolicy("node", ["--test"])).toBeNull()
  })
})

describe("CommandRunner", () => {
  it("reports the real exit code and output", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "runner-"))
    const runner = new CommandRunner()
    const ok = await runner.run({ command: "node", args: ["-e", "console.log('hello')"], cwd })
    expect(ok.exitCode).toBe(0)
    expect(ok.stdout).toContain("hello")

    const failing = await runner.run({ command: "node", args: ["-e", "process.exit(7)"], cwd })
    expect(failing.exitCode).toBe(7)
  })

  it("kills a command on timeout", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "runner-"))
    const runner = new CommandRunner()
    const result = await runner.run({
      command: "node",
      args: ["-e", "setTimeout(() => {}, 20000)"],
      cwd,
      timeoutMs: 600,
    })
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).not.toBe(0)
    expect(result.durationMs).toBeLessThan(8000)
  })

  it("truncates output beyond the limit", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "runner-"))
    const runner = new CommandRunner()
    const result = await runner.run({
      command: "node",
      args: ["-e", "process.stdout.write('x'.repeat(5000))"],
      cwd,
      maxOutputBytes: 512,
    })
    expect(result.truncated).toBe(true)
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(512)
  })

  it("does not leak secrets into the child environment", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "runner-"))
    process.env.REPOPILOT_TEST_SECRET = "super-secret"
    try {
      const runner = new CommandRunner()
      const result = await runner.run({ command: "node", args: ["-e", "console.log(process.env.REPOPILOT_TEST_SECRET ?? 'absent')"], cwd })
      expect(result.stdout.trim()).toBe("absent")
    } finally {
      delete process.env.REPOPILOT_TEST_SECRET
    }
  })

  it("returns a blocked result instead of spawning denied commands", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "runner-"))
    const runner = new CommandRunner()
    const result = await runner.run({ command: "npm", args: ["install"], cwd })
    expect(result.blocked).toBeDefined()
    expect(result.exitCode).toBeNull()
  })
})
