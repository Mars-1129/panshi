import { readFile } from "node:fs/promises"
import { join } from "node:path"

import type { StageContext, StageResult } from "../types.ts"

/**
 * Stage 3：黑盒符号提取与差分对拍。
 *
 * 业务本质不是「必须用 Ghidra」，而是：仓库里有一个**读不了源码的黑盒**，
 * 团队重写了它，需要证明新实现与原黑盒逐值等价。反编译只是把黑盒变白盒的
 * 辅助手段之一；对拍才是结论的来源，而它不需要任何反编译器。
 *
 * 本工段支持的黑盒类型：
 *   - WebAssembly（.wasm）：Node 原生加载，可用 Module.exports() 提取符号
 *   - 原生二进制（.so/.dll/.dylib/.class/.jar）：需要 Ghidra 才能反编译，
 *     对拍需要外部加载器；当前环境不具备时如实阻断
 *
 * 黑盒清单放在仓库根 `blackbox.json`：
 * {
 *   "targets": [{
 *     "binary": "lib/libdepreciation.wasm",
 *     "symbol": "monthly_depreciation",
 *     "implementation": "src/depreciation.mjs",
 *     "export": "monthlyDepreciation",
 *     "args": ["i32", "i32"],
 *     "domains": [[0, 5000000], [1, 360]]
 *   }]
 * }
 *
 * 没有清单或清单为空时返回 `not_applicable`：这个仓库没有黑盒，
 * 本工段不适用，从进度分母中排除，而不是判定为失败。
 */

type ArgKind = "i32" | "i64" | "f32" | "f64"

type BlackboxTarget = {
  binary: string
  symbol: string
  implementation: string
  export: string
  args: ArgKind[]
  domains?: Array<[number, number]>
}

type BlackboxManifest = { targets?: BlackboxTarget[] }

type SymbolReport = {
  binary: string
  kind: "wasm" | "native"
  bytes: number
  exports: Array<{ name: string; kind: string }>
}

type DiffCase = {
  args: number[]
  expected: number
  actual: number
  equal: boolean
}

type TargetResult = {
  binary: string
  symbol: string
  cases: number
  mismatches: number
  samples: DiffCase[]
  firstMismatch: DiffCase | null
}

const CASES_PER_TARGET = 1000
const SAMPLE_KEEP = 5

/**
 * TypeScript 在 Node 侧的 WebAssembly 只有命名空间声明，没有可用的构造器类型；
 * 这里用结构化类型描述实际用到的 API，避免把整段逻辑降级成 any。
 */
type WasmApi = {
  Module: {
    new (bytes: Uint8Array): unknown
    exports(module: unknown): Array<{ name: string; kind: string }>
  }
  Instance: new (
    module: unknown,
    imports?: Record<string, unknown>,
  ) => { exports: Record<string, unknown> }
}
const Wasm = (globalThis as unknown as { WebAssembly: WasmApi }).WebAssembly

/** 确定性 PRNG：同样的清单每次得到同样的对拍样本，结果可复现。 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalizeI64(value: unknown): number {
  return typeof value === "bigint" ? Number(value) : Number(value)
}

/** 把 f64/f32 的比较收敛掉浮点尾差，整型则要求完全相等。 */
function sameValue(a: number, b: number, kind: ArgKind | "return"): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Object.is(a, b)
  return a === b
}

function readTargets(manifest: unknown): BlackboxTarget[] {
  if (!manifest || typeof manifest !== "object") return []
  const list = (manifest as BlackboxManifest).targets
  if (!Array.isArray(list)) return []
  const out: BlackboxTarget[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue
    const item = raw as Record<string, unknown>
    const binary = typeof item.binary === "string" ? item.binary : ""
    const symbol = typeof item.symbol === "string" ? item.symbol : ""
    const implementation = typeof item.implementation === "string" ? item.implementation : ""
    const exportName = typeof item.export === "string" ? item.export : symbol
    if (!binary || !symbol || !implementation) continue
    const args = Array.isArray(item.args)
      ? (item.args.filter((a): a is ArgKind => a === "i32" || a === "i64" || a === "f32" || a === "f64"))
      : []
    const domains = Array.isArray(item.domains)
      ? (item.domains
          .filter((d): d is [number, number] => Array.isArray(d) && d.length === 2 && Number.isFinite(d[0]) && Number.isFinite(d[1]))
          .map((d) => [Number(d[0]), Number(d[1])] as [number, number]))
      : []
    out.push({ binary, symbol, implementation, export: exportName, args, domains })
  }
  return out
}

function pickArgs(kinds: ArgKind[], domains: Array<[number, number]>, random: () => number): number[] {
  return kinds.map((kind, index) => {
    const domain = domains[index]
    const low = domain ? domain[0] : kind === "i32" || kind === "i64" ? 0 : -1
    const high = domain ? domain[1] : kind === "i32" || kind === "i64" ? 100000 : 1
    const span = Math.max(0, high - low)
    const value = low + Math.floor(random() * (span + 1))
    if (kind === "i32" || kind === "i64") return Math.trunc(value)
    return Math.round(value * 100) / 100
  })
}

export async function runStage3(ctx: StageContext): Promise<StageResult> {
  const manifestPath = join(ctx.repoRoot, "blackbox.json")
  let manifest: unknown = null
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  } catch {
    manifest = null
  }

  const targets = readTargets(manifest)
  if (targets.length === 0) {
    // 没有声明黑盒 → 本工段不适用，不是失败。进度分母会排除它。
    return {
      status: "not_applicable",
      code: "no_blackbox_declared",
      message:
        "仓库未声明黑盒目标（blackbox.json 缺失或为空）；本工段不适用，已从进度分母中排除。"
        + "如需启用：在仓库根添加 blackbox.json，声明 wasm/二进制与对应的新实现。",
      notes: ["工段 03 不适用：该仓库没有被重写的黑盒模块"],
    }
  }

  const symbols: SymbolReport[] = []
  const results: TargetResult[] = []
  const blocked: string[] = []

  for (const target of targets) {
    const absolute = join(ctx.repoRoot, target.binary)
    let bytes: Buffer
    try {
      bytes = await readFile(absolute)
    } catch {
      blocked.push(`${target.binary}：清单声明的黑盒文件不存在`)
      continue
    }

    const isWasm = target.binary.toLowerCase().endsWith(".wasm")
    if (!isWasm) {
      // 原生二进制：需要 Ghidra 反编译 + 外部加载器；如实阻断，不伪造结论。
      symbols.push({
        binary: target.binary,
        kind: "native",
        bytes: bytes.byteLength,
        exports: [],
      })
      blocked.push(`${target.binary}：原生二进制需要 Ghidra 与对应的加载器，当前环境不具备`)
      continue
    }

    // 1) 符号提取：不读源码，只看模块对外导出了什么
    let module: unknown
    try {
      module = new Wasm.Module(bytes)
    } catch (error) {
      blocked.push(`${target.binary}：无法解析为 WebAssembly 模块（${error instanceof Error ? error.message : "未知错误"}）`)
      continue
    }
    const exports = Wasm.Module.exports(module).map((item) => ({ name: item.name, kind: item.kind }))
    symbols.push({ binary: target.binary, kind: "wasm", bytes: bytes.byteLength, exports })

    const hasSymbol = exports.some((item) => item.name === target.symbol && item.kind === "function")
    if (!hasSymbol) {
      blocked.push(`${target.binary}：模块没有导出函数 ${target.symbol}（实际导出：${exports.map((e) => e.name).join(", ") || "无"}）`)
      continue
    }

    // 2) 加载新实现（被验证的一方）
    let implementation: unknown
    try {
      implementation = await import(`file://${join(ctx.repoRoot, target.implementation).replace(/\\/g, "/")}`)
    } catch (error) {
      blocked.push(`${target.implementation}：无法加载新实现（${error instanceof Error ? error.message : "未知错误"}）`)
      continue
    }
    const candidate = (implementation as Record<string, unknown>)[target.export]
    if (typeof candidate !== "function") {
      blocked.push(`${target.implementation}：没有导出函数 ${target.export}`)
      continue
    }
    const callNew = candidate as (...args: number[]) => unknown

    // 3) 差分对拍：同一组输入分别喂给原黑盒与新实现
    const instance = new Wasm.Instance(module, {})
    const original = instance.exports[target.symbol] as (...args: number[]) => unknown
    if (typeof original !== "function") {
      blocked.push(`${target.binary}：导出 ${target.symbol} 不是可调用函数`)
      continue
    }

    const random = makeRandom(0x9e3779b9 ^ targets.indexOf(target))
    let mismatches = 0
    let firstMismatch: DiffCase | null = null
    const samples: DiffCase[] = []

    for (let index = 0; index < CASES_PER_TARGET; index += 1) {
      const args = pickArgs(target.args.length > 0 ? target.args : ["i32", "i32"], target.domains ?? [], random)
      let expected: number
      let actual: number
      try {
        expected = normalizeI64(original(...args))
        actual = normalizeI64(callNew(...args))
      } catch (error) {
        mismatches += 1
        if (!firstMismatch) {
          firstMismatch = {
            args,
            expected: Number.NaN,
            actual: Number.NaN,
            equal: false,
          }
        }
        continue
      }
      const equal = sameValue(expected, actual, "return")
      if (!equal) {
        mismatches += 1
        const record: DiffCase = { args, expected, actual, equal }
        if (!firstMismatch) firstMismatch = record
        if (samples.length < SAMPLE_KEEP) samples.push(record)
      }
    }

    results.push({
      binary: target.binary,
      symbol: target.symbol,
      cases: CASES_PER_TARGET,
      mismatches,
      samples,
      firstMismatch,
    })
  }

  // ---- 事件与工件
  await ctx.emit("decompile.symbols", {
    stageId: 3,
    reports: symbols,
    targets: targets.length,
  })

  const totalCases = results.reduce((sum, item) => sum + item.cases, 0)
  const totalMismatches = results.reduce((sum, item) => sum + item.mismatches, 0)

  await ctx.emit("decompile.diff", {
    stageId: 3,
    cases: totalCases,
    mismatches: totalMismatches,
    targets: results.map((item) => ({
      binary: item.binary,
      symbol: item.symbol,
      cases: item.cases,
      mismatches: item.mismatches,
      samples: item.samples,
    })),
  })

  const report = {
    generatedAt: new Date().toISOString(),
    targets: results,
    blocked,
    totalCases,
    totalMismatches,
  }
  const artifact = await ctx.store.saveArtifact({
    taskId: ctx.taskId,
    stage: 3,
    name: "decompile-report.json",
    kind: "report",
    content: JSON.stringify(report, null, 2),
  })

  // 有目标被阻断且没有一条通过 → 整个工段阻断
  if (results.length === 0) {
    return {
      status: "blocked",
      code: "blackbox_unusable",
      message: blocked.join("；") || "黑盒清单中的目标均无法加载",
      artifacts: [artifact],
    }
  }

  const verified = totalMismatches === 0 && blocked.length === 0
  await ctx.emit("decompile.equivalence", {
    stageId: 3,
    verified,
    cases: totalCases,
    mismatches: totalMismatches,
    statement: verified
      ? `${totalCases} 组输入下，新实现与 ${results.length} 个黑盒目标输出完全一致`
      : `${totalCases} 组输入中有 ${totalMismatches} 组不一致`,
  })

  if (!verified) {
    const first = results.find((item) => item.firstMismatch)?.firstMismatch
    return {
      status: "failed",
      code: "equivalence_mismatch",
      message: first
        ? `对拍不一致：入参 (${first.args.join(", ")}) 原实现返回 ${first.expected}，新实现返回 ${first.actual}`
        : `对拍不一致：${totalMismatches}/${totalCases} 组`,
      artifacts: [artifact],
      notes: blocked,
    }
  }

  return {
    status: "succeeded",
    message: `${totalCases} 组差分对拍全部一致${blocked.length ? `（另有 ${blocked.length} 个目标未完成）` : ""}`,
    artifacts: [artifact],
    notes: blocked,
  }
}
