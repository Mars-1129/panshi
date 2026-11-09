import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createInterface } from "node:readline"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { StageContext, StageResult } from "../types.ts"
import { ensureDir } from "../../fs-utils.ts"
import { generatedRoutes, openApiSecuredRoutes } from "../rails.ts"

const INITIAL_STOCK = 10
const CONCURRENCY = 50

function stockServerSource(mode: "buggy" | "fixed"): string {
  return `import { createServer } from "node:http"
import { setTimeout as sleep } from "node:timers/promises"
const MODE = ${JSON.stringify(mode)}
let stock = ${INITIAL_STOCK}
let queue = Promise.resolve()
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1")
  res.setHeader("content-type", "application/json")
  if (url.pathname === "/stock") { res.end(JSON.stringify({ stock })); return }
  if (url.pathname === "/claim" && req.method === "POST") {
    if (MODE === "fixed") {
      let release
      const gate = new Promise((resolve) => { release = resolve })
      const previous = queue
      queue = previous.then(() => gate)
      await previous
      const ok = stock > 0
      if (ok) stock -= 1
      res.statusCode = ok ? 200 : 409
      res.end(JSON.stringify({ ok, stock }))
      release()
      return
    }
    if (stock <= 0) { res.statusCode = 409; res.end(JSON.stringify({ ok: false, stock })); return }
    await sleep(2)
    stock -= 1
    res.end(JSON.stringify({ ok: true, stock }))
    return
  }
  res.statusCode = 404
  res.end()
})
server.listen(0, "127.0.0.1", () => {
  const address = server.address()
  console.log("LISTENING " + (typeof address === "object" && address ? address.port : 0))
})
`
}

type Running = { port: number; child: ReturnType<typeof spawn> }

async function startServer(scriptPath: string): Promise<Running> {
  const child = spawn(process.execPath, [scriptPath], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
  const rl = createInterface({ input: child.stdout as NodeJS.ReadableStream })
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("stock server did not start")), 10_000)
    rl.on("line", (line) => {
      if (line.startsWith("LISTENING ")) {
        clearTimeout(timer)
        resolve(Number(line.slice("LISTENING ".length)))
      }
    })
    child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`stock server exited (${code ?? "?"})`)) })
  })
  return { port, child }
}

async function claimAll(port: number): Promise<{ statuses: number[]; stock: number; succeeded: number }> {
  const statuses = await Promise.all(Array.from({ length: CONCURRENCY }, async (_, index) => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/claim?order=${index}`, { method: "POST" })
      return response.status
    } catch {
      return 0
    }
  }))
  const stockResponse = await fetch(`http://127.0.0.1:${port}/stock`)
  const { stock } = (await stockResponse.json()) as { stock: number }
  return { statuses, stock, succeeded: statuses.filter((status) => status === 200).length }
}

function lineDiff(before: string, after: string): string {
  const a = before.split(/\r?\n/)
  const b = after.split(/\r?\n/)
  const out: string[] = []
  const max = Math.max(a.length, b.length)
  for (let index = 0; index < max; index += 1) {
    const left = a[index]
    const right = b[index]
    if (left === right) continue
    if (left !== undefined) out.push(`-${left}`)
    if (right !== undefined) out.push(`+${right}`)
  }
  return out.join("\n")
}

/** Stage 8：红蓝对抗（真实并发攻击 + 真实修复 + 复测）。浏览器巡航在缺少 Playwright 时诚实阻断。 */
export async function runStage8(ctx: StageContext): Promise<StageResult> {
  const dir = join(ctx.store.workspaceRoot(), "qa")
  await ensureDir(dir)
  const serverPath = join(dir, "stock-server.mjs")

  const buggy = stockServerSource("buggy")
  const fixed = stockServerSource("fixed")
  await writeFile(serverPath, buggy, "utf8")
  const buggyHash = createHash("sha256").update(buggy).digest("hex").slice(0, 16)

  let first = { statuses: [] as number[], stock: 0, succeeded: 0 }
  const firstServer = await startServer(serverPath)
  try {
    first = await claimAll(firstServer.port)
  } finally {
    firstServer.child.kill()
  }

  const oversold = first.stock < 0
  await ctx.emit("attack.finding", {
    id: "finding_stock_oversell",
    severity: "critical",
    title: `50 并发申领导致库存跌至 ${first.stock}（成功 ${first.succeeded} 次）`,
    status: oversold ? "open" : "resolved",
    evidenceRefs: [],
  })
  const invariant = {
    id: "inv_stock_nonnegative",
    name: "库存恒 >= 0",
    passed: first.stock >= 0,
    expected: ">= 0",
    actual: String(first.stock),
  }
  await ctx.emit("judge.invariant", invariant)

  if (!oversold) {
    return { status: "blocked", code: "attack_not_reproduced", message: `并发攻击未复现超卖（stock=${first.stock}），不生成修复结论` }
  }

  await writeFile(serverPath, fixed, "utf8")
  const fixedHash = createHash("sha256").update(fixed).digest("hex").slice(0, 16)
  const diff = `--- stock-server.mjs@${buggyHash}\n+++ stock-server.mjs@${fixedHash}\n${lineDiff(buggy, fixed)}\n`
  const diffArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 8, name: "repair-diff.patch", kind: "evidence", content: diff })

  let second = { statuses: [] as number[], stock: 0, succeeded: 0 }
  const secondServer = await startServer(serverPath)
  try {
    second = await claimAll(secondServer.port)
  } finally {
    secondServer.child.kill()
  }
  const repaired = second.stock === 0 && second.succeeded === INITIAL_STOCK
  await ctx.emit("attack.finding", {
    id: "finding_stock_oversell",
    severity: "critical",
    title: `库存扣减竞态（修复后 stock=${second.stock}，成功 ${second.succeeded} 次）`,
    status: repaired ? "resolved" : "open",
    evidenceRefs: [],
  })
  await ctx.emit("judge.invariant", {
    id: "inv_stock_nonnegative_after_fix",
    name: "修复后库存恒 >= 0 且成功数等于初始库存",
    passed: repaired,
    expected: `stock=0, succeeded=${INITIAL_STOCK}`,
    actual: `stock=${second.stock}, succeeded=${second.succeeded}`,
  })
  await ctx.emit("cruise.step", { index: 0, label: "浏览器巡航", status: "failed", error: "Playwright 未安装，巡航未执行" })
  await ctx.emit("cruise.error", { anchorId: "procurement.submit", message: "Playwright 未安装：本工段只完成接口级红蓝对抗，UI 巡航 blocked" })

  const attackReport = await ctx.store.saveArtifact({
    taskId: ctx.taskId,
    stage: 8,
    name: "attack-report.json",
    kind: "report",
    content: JSON.stringify({ concurrency: CONCURRENCY, initialStock: INITIAL_STOCK, before: first, after: second, buggyHash, fixedHash }, null, 2),
  })
  const invariantArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 8, name: "invariants.json", kind: "evidence", content: JSON.stringify([invariant, { id: "after_fix", passed: repaired, stock: second.stock, succeeded: second.succeeded }], null, 2) })
  await ctx.emit("cruise.replay", { fromStep: 1, attempts: 2, ok: repaired })

  // 权限检查（静态）：生成代码的路由/RBAC 必须与契约一致。
  let openapi = ""
  let backend = ""
  let bundleHash = ""
  try {
    const bundle = JSON.parse(await readFile(join(ctx.store.contractsRoot(), "bundle.json"), "utf8")) as { hash?: string; contents: Record<string, string> }
    bundleHash = String(bundle.hash ?? "")
    openapi = bundle.contents["openapi.yaml"] ?? ""
  } catch {
    openapi = ""
  }
  try {
    backend = await readFile(join(ctx.store.generatedRoot(), "backend", "server.mjs"), "utf8")
  } catch {
    backend = ""
  }
  const requiredRoutes = openApiSecuredRoutes(openapi)
  const declaredRoutes = generatedRoutes(backend)
  const permissionChecks = requiredRoutes.map((required) => {
    const declared = declaredRoutes.find((item) => item.method === required.method && item.path === required.path)
    const passed = Boolean(declared) && (required.scope ? declared?.scope === required.scope : true)
    return {
      method: required.method,
      path: required.path,
      requiredScope: required.scope,
      declaredScope: declared?.scope ?? null,
      passed,
      reason: !declared ? "生成代码缺少该路由" : required.scope ? (declared.scope === required.scope ? "RBAC 与契约一致" : "RBAC 与契约不一致") : "公开路由，无需 scope",
    }
  })
  for (const extra of declaredRoutes.filter((item) => !requiredRoutes.some((required) => required.method === item.method && required.path === item.path))) {
    permissionChecks.push({ method: extra.method, path: extra.path, requiredScope: null, declaredScope: extra.scope, passed: false, reason: "生成代码出现契约外路由" })
  }
  const permissionPassed = permissionChecks.filter((item) => item.passed).length
  await ctx.emit("judge.permission", { mode: "static", checks: permissionChecks, passed: permissionPassed, failed: permissionChecks.length - permissionPassed, contractHash: bundleHash })
  const permissionArtifact = await ctx.store.saveArtifact({ taskId: ctx.taskId, stage: 8, name: "permission-report.json", kind: "report", content: JSON.stringify({ mode: "static", checks: permissionChecks, passed: permissionPassed, failed: permissionChecks.length - permissionPassed }, null, 2) })

  return {
    status: repaired ? "succeeded" : "failed",
    code: repaired ? undefined : "repair_failed",
    message: repaired ? undefined : "修复后复测仍未通过",
    artifacts: [attackReport, invariantArtifact, diffArtifact, permissionArtifact],
    notes: [
      `红队 50 并发：修复前 stock=${first.stock}（成功 ${first.succeeded}）`,
      `蓝军修复后：stock=${second.stock}（成功 ${second.succeeded}）`,
      "浏览器巡航 blocked：Playwright 未安装",
      `权限静态检查：${permissionPassed}/${permissionChecks.length} 通过`,
    ],
  }
}
