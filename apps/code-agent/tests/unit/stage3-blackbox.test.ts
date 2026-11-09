import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { runStage3 } from "../../server/core/factory/stages/s3.ts"

/**
 * 工段 03 的两条路径：
 *   - 仓库声明了黑盒 → 真实差分对拍，输出 decompile.* 三个事件
 *   - 仓库没有黑盒 → not_applicable（不是失败），从进度分母排除
 */

/** 一个最小的 wasm 黑盒：f(a,b) = a * 2 + b */
const DOUBLE_ADD_WASM = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic + version
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f, // type (i32,i32)->i32
  0x03, 0x02, 0x01, 0x00, // func 0 : type 0
  0x07, 0x0a, 0x01, 0x06, 0x64, 0x6f, 0x75, 0x62, 0x6c, 0x65, 0x00, 0x00, // export "double" -> 0
  0x0a, 0x0c, 0x01, 0x0a, 0x00, 0x20, 0x00, 0x41, 0x02, 0x6c, 0x20, 0x01, 0x6a, 0x0b, // code
])

function makeCtx(repoRoot: string, events: Array<{ type: string; payload: Record<string, unknown> }>) {
  return {
    taskId: "t1",
    stage: 3,
    stageRun: {} as never,
    repoRoot,
    runDir: "",
    store: {
      saveArtifact: async (input: Record<string, unknown>) => ({ artifactId: "a1", ...input }),
    } as never,
    runner: {} as never,
    git: {} as never,
    limits: {} as never,
    emit: async (type: string, payload: Record<string, unknown>) => {
      events.push({ type, payload })
    },
    confirm: false,
    events: [],
    ai: { enabled: false, provider: null },
  }
}

describe("stage 3 · blackbox and differential testing", () => {
  it("returns not_applicable when the repo declares no blackbox", async () => {
    const root = await mkdtemp(join(tmpdir(), "s3-na-"))
    const events: Array<{ type: string; payload: Record<string, unknown> }> = []
    const result = await runStage3(makeCtx(root, events) as never)

    expect(result.status).toBe("not_applicable")
    expect(result.code).toBe("no_blackbox_declared")
    // 不适用不应该产生「通过」或「失败」类事件
    expect(events).toHaveLength(0)
  })

  it("passes when the rewritten implementation matches the blackbox", async () => {
    const root = await mkdtemp(join(tmpdir(), "s3-ok-"))
    await mkdir(join(root, "lib"), { recursive: true })
    await writeFile(join(root, "lib", "core.wasm"), DOUBLE_ADD_WASM)
    await writeFile(join(root, "double.mjs"), "export function double(a, b) { return a * 2 + b }\n")
    await writeFile(
      join(root, "blackbox.json"),
      JSON.stringify({
        targets: [
          {
            binary: "lib/core.wasm",
            symbol: "double",
            implementation: "double.mjs",
            export: "double",
            args: ["i32", "i32"],
            domains: [[0, 1000], [0, 1000]],
          },
        ],
      }),
    )

    const events: Array<{ type: string; payload: Record<string, unknown> }> = []
    const result = await runStage3(makeCtx(root, events) as never)

    expect(result.status).toBe("succeeded")
    expect(events.map((event) => event.type)).toEqual([
      "decompile.symbols",
      "decompile.diff",
      "decompile.equivalence",
    ])
    const diff = events.find((event) => event.type === "decompile.diff")
    expect(diff?.payload.cases).toBe(1000)
    expect(diff?.payload.mismatches).toBe(0)
    const equivalence = events.find((event) => event.type === "decompile.equivalence")
    expect(equivalence?.payload.verified).toBe(true)
  })

  it("fails and reports the first mismatch when the rewrite diverges", async () => {
    const root = await mkdtemp(join(tmpdir(), "s3-bad-"))
    await mkdir(join(root, "lib"), { recursive: true })
    await writeFile(join(root, "lib", "core.wasm"), DOUBLE_ADD_WASM)
    // 故意写错：少乘 2
    await writeFile(join(root, "double.mjs"), "export function double(a, b) { return a + b }\n")
    await writeFile(
      join(root, "blackbox.json"),
      JSON.stringify({
        targets: [
          {
            binary: "lib/core.wasm",
            symbol: "double",
            implementation: "double.mjs",
            export: "double",
            args: ["i32", "i32"],
            domains: [[1, 1000], [0, 1000]],
          },
        ],
      }),
    )

    const events: Array<{ type: string; payload: Record<string, unknown> }> = []
    const result = await runStage3(makeCtx(root, events) as never)

    expect(result.status).toBe("failed")
    expect(result.code).toBe("equivalence_mismatch")
    const equivalence = events.find((event) => event.type === "decompile.equivalence")
    expect(equivalence?.payload.verified).toBe(false)
    expect(Number(equivalence?.payload.mismatches)).toBeGreaterThan(0)
  })

  it("blocks when the declared blackbox file is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "s3-missing-"))
    await writeFile(join(root, "impl.mjs"), "export function f() { return 0 }\n")
    await writeFile(
      join(root, "blackbox.json"),
      JSON.stringify({
        targets: [{ binary: "lib/gone.wasm", symbol: "f", implementation: "impl.mjs", export: "f", args: [] }],
      }),
    )

    const events: Array<{ type: string; payload: Record<string, unknown> }> = []
    const result = await runStage3(makeCtx(root, events) as never)

    expect(result.status).toBe("blocked")
    expect(result.code).toBe("blackbox_unusable")
  })

  it("is deterministic: the same manifest yields the same sample", async () => {
    const root = await mkdtemp(join(tmpdir(), "s3-det-"))
    await mkdir(join(root, "lib"), { recursive: true })
    await writeFile(join(root, "lib", "core.wasm"), DOUBLE_ADD_WASM)
    await writeFile(join(root, "double.mjs"), "export function double(a, b) { return a * 2 + b }\n")
    await writeFile(
      join(root, "blackbox.json"),
      JSON.stringify({
        targets: [
          {
            binary: "lib/core.wasm",
            symbol: "double",
            implementation: "double.mjs",
            export: "double",
            args: ["i32", "i32"],
            domains: [[1, 1000], [0, 1000]],
          },
        ],
      }),
    )

    const first: Array<{ type: string; payload: Record<string, unknown> }> = []
    const second: Array<{ type: string; payload: Record<string, unknown> }> = []
    await runStage3(makeCtx(root, first) as never)
    await runStage3(makeCtx(root, second) as never)

    const pick = (events: typeof first) =>
      (events.find((event) => event.type === "decompile.diff")?.payload as { cases: number }).cases
    expect(pick(first)).toBe(pick(second))
  })
})
