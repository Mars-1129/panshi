/**
 * 新建项目端到端验收：示例"会议室预约系统"。
 * 从 `.panshi/requirement.json` 出发，验证契约、原型与代码确实由需求生成，而不是内置采购模板。
 *
 * 用法：pnpm e2e:project
 */
import { spawn, spawnSync } from "node:child_process"
import { cp, mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const appRoot = resolve(import.meta.dirname, "..")
const sampleRepo = resolve(appRoot, "../../samples/meeting-room")

type Check = { name: string; ok: boolean; detail: string }
const checks: Check[] = []
const check = (name: string, ok: boolean, detail: string): void => { checks.push({ name, ok, detail }) }

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      server.close(() => resolvePort(port))
    })
  })
}

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true })
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`)
}

const tempRoot = await mkdtemp(join(tmpdir(), "panshi-e2e-project-"))
const repoDir = join(tempRoot, "meeting-room")
const state: { child: ReturnType<typeof spawn> | null } = { child: null }
const log: string[] = []

try {
  await cp(sampleRepo, repoDir, { recursive: true, filter: (source) => !/[\\/](\.git|\.repo-agent|node_modules|dist)$/.test(source) })
  git(repoDir, ["init", "-q"])
  git(repoDir, ["config", "user.name", "PanShi E2E"])
  git(repoDir, ["config", "user.email", "e2e@localhost"])
  git(repoDir, ["config", "commit.gpgsign", "false"])
  git(repoDir, ["add", "-A"])
  git(repoDir, ["commit", "-q", "--no-verify", "-m", "e2e meeting room"])

  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  state.child = spawn(process.execPath, ["server/main.ts", `--port=${port}`, `--repo=${repoDir}`], {
    cwd: appRoot,
    env: { ...process.env, REPOPILOT_PROVIDER: "fake", REPOPILOT_AI_CONFIG: join(tempRoot, "ai.json") },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  state.child.stdout?.on("data", (chunk) => log.push(String(chunk)))
  state.child.stderr?.on("data", (chunk) => log.push(String(chunk)))

  const headers = { "X-RepoPilot-Request": "1", "Content-Type": "application/json" }
  const api = async (path: string, init: RequestInit = {}): Promise<{ status: number; json: any }> => {
    const response = await fetch(base + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
    const text = await response.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { json = null }
    return { status: response.status, json }
  }

  let healthy = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await api("/api/runtime/health")
      healthy = health.status === 200 && health.json?.repoReady === true
      if (healthy) break
    } catch {
      // starting
    }
    await new Promise((done) => setTimeout(done, 250))
  }
  check("服务就绪", healthy, repoDir)

  const created = await api("/api/runtime/tasks", {
    method: "POST",
    body: JSON.stringify({ title: "会议室预约系统 1.0", summary: "新建项目验收", mode: "generate" }),
  })
  const taskId = created.json?.task?.id as string | undefined
  check("创建项目任务", created.status === 201 && Boolean(taskId), taskId ?? `HTTP ${created.status}`)
  if (!taskId) throw new Error("task not created")

  const guarded = await api(`/api/runtime/tasks/${taskId}/stages/5/run`, { method: "POST", body: "{}" })
  check("契约锁定需确认", guarded.status === 409 && guarded.json?.error?.code === "confirmation_required", `HTTP ${guarded.status}`)

  await api(`/api/runtime/tasks/${taskId}/stages/run-all`, { method: "POST", body: '{"confirm":true}' })

  let stages: any[] = []
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 1000))
    stages = (await api(`/api/runtime/tasks/${taskId}/stages`)).json?.stages ?? []
    const last = stages.find((item) => item.stage === 9)
    if (last && last.status !== "running") break
  }
  const done = stages.filter((item) => item.status === "succeeded").length
  const blocked = stages.filter((item) => item.status === "blocked")
  check("十工段完成", stages.length === 10 && done === 9 && blocked.length === 1 && blocked[0]?.stage === 3, `通过 ${done}，阻断 ${blocked.map((item) => item.stage).join(",")}`)

  const contracts = (await api(`/api/runtime/tasks/${taskId}/contracts`)).json?.bundle
  check("契约锁定", Boolean(contracts?.locked) && /^[a-f0-9]{32,64}$/.test(String(contracts?.hash)), `v${contracts?.version} ${String(contracts?.hash).slice(0, 12)}`)

  const artifacts: any[] = (await api(`/api/runtime/tasks/${taskId}/artifacts`)).json?.artifacts ?? []
  const byName = (name: string): any => artifacts.find((item) => item.name === name)
  const read = async (name: string): Promise<string> => {
    const artifact = byName(name)
    if (!artifact) return ""
    const detail = await api(`/api/runtime/tasks/${taskId}/artifacts/${artifact.artifactId}`)
    return String(detail.json?.content ?? "")
  }

  const schema = await read("schema.sql")
  check("数据库契约来自需求", schema.includes("CREATE TABLE meeting_room") && schema.includes("CREATE TABLE booking"), "meeting_room / booking")

  const openapi = await read("openapi.yaml")
  check("接口契约来自锚点", openapi.includes("/api/meeting/calendar:") && openapi.includes("rbac: [meeting:approve]"), "7 条路由")

  const backend = await read("backend-server.mjs")
  const routeCount = (backend.match(/method:/g) ?? []).length
  check("后端代码按契约生成", backend.includes("/api/meeting/bookings") && routeCount === 7, `${routeCount} 条路由`)

  const views = artifacts.filter((item) => item.stage === 6 && /\.vue$/.test(item.name))
  check("前端页面按锚点生成", views.length === 7, `${views.length} 个 Vue 页面`)

  const events: any[] = (await api(`/api/runtime/tasks/${taskId}/events?json=1`)).json?.events ?? []
  const proto = events.filter((item) => item.type === "prototype.ready").at(-1)?.payload
  const anchorIds: string[] = (proto?.anchorList ?? []).map((anchor: any) => anchor.id)
  check(
    "原型锚点来自需求包",
    proto?.product === "会议室预约系统" && anchorIds.length === 7 && anchorIds.includes("booking.create") && anchorIds.includes("settings.update"),
    anchorIds.join("、"),
  )

  const permission = events.filter((item) => item.type === "judge.permission").at(-1)?.payload
  check("权限检查覆盖全部锚点", Number(permission?.passed) === 7 && Number(permission?.failed) === 0, `${permission?.passed}/${permission?.checks?.length} 通过`)

  const violations = events.filter((item) => item.type === "rail.violation").map((item) => String(item.payload?.railName))
  const contractViolations = events.filter((item) => item.type === "rail.violation" && item.payload?.railName === "ContractVerifyRail")
  check("生成代码通过契约护栏", contractViolations.length === 0, violations.join("、") || "无")

  const delivery = events.filter((item) => item.type === "delivery.report").at(-1)?.payload
  check("交付报告保留阻断项", delivery?.verified === false && delivery?.blocked?.length === 1, `阻断 ${delivery?.blocked?.length} 项`)
} catch (error) {
  check("执行未中断", false, error instanceof Error ? error.message : String(error))
} finally {
  if (state.child) {
    state.child.kill()
    await new Promise((done) => setTimeout(done, 300))
  }
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 5 }).catch(() => undefined)
}

const passed = checks.filter((item) => item.ok).length
for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}  —  ${item.detail}`)
console.log(`\n${passed}/${checks.length} 项通过`)
if (passed !== checks.length) {
  console.log("\n最近的服务器日志：")
  console.log(log.join("").split(/\r?\n/).slice(-20).join("\n"))
  process.exitCode = 1
} else {
  console.log("新建项目验收通过：需求包 → 契约 → 原型 → 代码 → 权限 → 交付，全部来自同一份需求。")
}
