/**
 * 端到端验收：复制样例靶场 → 起真实 HTTP 服务 → 创建任务 → 十工段全链路 → 逐项断言。
 * 只依赖 Node 内置能力；不写用户工作区，全部在临时目录里完成。
 *
 * 用法：pnpm e2e
 */
import { spawn, spawnSync } from "node:child_process"
import { cp, mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const appRoot = resolve(import.meta.dirname, "..")
const sampleRepo = resolve(appRoot, "../../samples/legacy-procurement")

type Check = { name: string; ok: boolean; detail: string }
const checks: Check[] = []
const check = (name: string, ok: boolean, detail: string): void => {
  checks.push({ name, ok, detail })
}

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

const tempRoot = await mkdtemp(join(tmpdir(), "panshi-e2e-"))
const repoDir = join(tempRoot, "legacy-procurement")
const log: string[] = []
const state: { child: ReturnType<typeof spawn> | null } = { child: null }

async function main(): Promise<void> {
  await cp(sampleRepo, repoDir, {
    recursive: true,
    filter: (source) => !/[\\/](\.git|\.repo-agent|node_modules|dist)$/.test(source),
  })
  git(repoDir, ["init", "-q"])
  git(repoDir, ["config", "user.name", "PanShi E2E"])
  git(repoDir, ["config", "user.email", "e2e@localhost"])
  git(repoDir, ["config", "commit.gpgsign", "false"])
  git(repoDir, ["add", "-A"])
  git(repoDir, ["commit", "-q", "--no-verify", "-m", "e2e fixture"])

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
  const api = async (path: string, init: RequestInit = {}): Promise<{ status: number; json: any; text: string }> => {
    const response = await fetch(base + path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
    const text = await response.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
    return { status: response.status, json, text }
  }

  let healthy = false
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await api("/api/runtime/health")
      healthy = health.status === 200 && health.json?.repoReady === true
      if (healthy) break
    } catch {
      // server still starting
    }
    await new Promise((done) => setTimeout(done, 250))
  }
  check("服务启动与仓库就绪", healthy, healthy ? repoDir : "health 未就绪")
  if (!healthy) throw new Error("server did not become healthy")

  const created = await api("/api/runtime/tasks", {
    method: "POST",
    body: JSON.stringify({ title: "E2E 验收：国企采购系统信创改造", summary: "自动化全链路验收", mode: "generate" }),
  })
  const taskId = created.json?.task?.id as string | undefined
  check("创建任务", created.status === 201 && Boolean(taskId), taskId ?? `HTTP ${created.status}`)
  if (!taskId) throw new Error("task not created")

  const guarded = await api(`/api/runtime/tasks/${taskId}/stages/5/run`, { method: "POST", body: "{}" })
  check(
    "写操作二次确认（409）",
    guarded.status === 409 && guarded.json?.error?.code === "confirmation_required",
    `HTTP ${guarded.status} ${guarded.json?.error?.code ?? ""}`,
  )

  const started = await api(`/api/runtime/tasks/${taskId}/stages/run-all`, { method: "POST", body: '{"confirm":true}' })
  check("启动十工段全链路", started.status === 202 && started.json?.started === true, `HTTP ${started.status}`)

  let stages: any[] = []
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 1000))
    const response = await api(`/api/runtime/tasks/${taskId}/stages`)
    stages = response.json?.stages ?? []
    const last = stages.find((item) => item.stage === 9)
    if (last && last.status !== "running") break
  }

  check("十个工段全部有结果", stages.length === 10, `${stages.length} 个 StageRun`)
  const done = stages.filter((item) => item.status === "succeeded").length
  const blocked = stages.filter((item) => item.status === "blocked")
  const failed = stages.filter((item) => item.status === "failed")
  check("9 通过 / 1 阻断 / 0 失败", done === 9 && blocked.length === 1 && failed.length === 0, `通过 ${done}，阻断 ${blocked.length}，失败 ${failed.length}`)
  check(
    "阻断工段是 03 且原因真实",
    blocked[0]?.stage === 3 && String(blocked[0]?.failure?.code) === "no_binary_target" && /二进制|\.so/.test(String(blocked[0]?.failure?.message)),
    `工段 ${blocked[0]?.stage} ${blocked[0]?.failure?.code ?? ""}`,
  )

  const contracts = await api(`/api/runtime/tasks/${taskId}/contracts`)
  const bundle = contracts.json?.bundle
  check(
    "契约已锁定且哈希可追溯",
    Boolean(bundle?.locked) && Number(bundle?.version) === 1 && /^[a-f0-9]{32,64}$/.test(String(bundle?.hash)),
    `v${bundle?.version} ${String(bundle?.hash).slice(0, 12)}`,
  )

  const artifactsResponse = await api(`/api/runtime/tasks/${taskId}/artifacts`)
  const artifacts: any[] = artifactsResponse.json?.artifacts ?? []
  const names = new Set(artifacts.map((item) => item.name))
  const required = [
    "project-manifest.json", "business-rules.json", "code-slices.json",
    "SKILL.md", "harness-report.json",
    "schema.sql", "openapi.yaml", "component_tree.json", "prototype.html",
    "rail-report.json", "attack-report.json", "repair-diff.patch", "permission-report.json",
    "delivery-report.json", "source-ledger.json", "evolution-skillpack.md",
  ]
  const missing = required.filter((name) => !names.has(name))
  check("关键产物齐全", missing.length === 0, missing.length === 0 ? `${artifacts.length} 份产物` : `缺少 ${missing.join(", ")}；现有 ${[...names].join(",")}`)

  const rulesArtifact = artifacts.find((item) => item.name === "business-rules.json")
  if (rulesArtifact) {
    const detail = await api(`/api/runtime/tasks/${taskId}/artifacts/${rulesArtifact.artifactId}`)
    let rules: any[] = []
    try {
      rules = JSON.parse(detail.json?.content ?? "[]")
    } catch {
      rules = []
    }
    check(
      "业务规则带来源位置",
      rules.length >= 10 && rules.every((rule) => typeof rule.path === "string" && Number(rule.line) > 0),
      `${rules.length} 条规则，示例 ${rules[0]?.path}:${rules[0]?.line}`,
    )
  } else {
    check("业务规则带来源位置", false, "缺少 business-rules.json")
  }

  const eventsResponse = await api(`/api/runtime/tasks/${taskId}/events?json=1`)
  const events: any[] = eventsResponse.json?.events ?? []
  const of = (type: string): any[] => events.filter((event) => event.type === type)
  check("事件日志可回放", events.length >= 60, `${events.length} 条事件`)

  const diagnosis = of("greenbuild.diagnosis").at(-1)
  check(
    "构建失败被正确分类为测试问题",
    Number(diagnosis?.payload?.exitCode) === 1 && String(diagnosis?.payload?.classification) === "test",
    `exit ${diagnosis?.payload?.exitCode} / ${diagnosis?.payload?.classification}`,
  )

  const approvals = of("approval.resolved")
  check(
    "人工审批留痕（工段 05/06）",
    approvals.length === 2 && approvals.every((item) => item.payload?.decision === "approved"),
    approvals.map((item) => `stage ${item.payload?.stage}`).join("、"),
  )

  const permission = of("judge.permission").at(-1)
  check(
    "权限检查与契约一致",
    Number(permission?.payload?.passed) === 5 && Number(permission?.payload?.failed) === 0,
    `${permission?.payload?.passed}/${permission?.payload?.checks?.length} 通过`,
  )

  const railStats = of("rail.stats").at(-1)
  check("护栏统计", Number(railStats?.payload?.rails) === 7 && Number(railStats?.payload?.checks) > 0, `7 道关卡 · 检查 ${railStats?.payload?.checks} 项`)

  const ledger = of("source.ledger").at(-1)
  check(
    "来源与许可证台账",
    Number(ledger?.payload?.total) === 4 && Number(ledger?.payload?.unknownLicenses) === 1,
    `4 条来源，1 条许可证未知`,
  )

  const invariants = of("judge.invariant")
  const attack = of("attack.finding").at(-1)
  check(
    "红蓝对抗：先复现后修复",
    invariants.some((item) => item.payload?.passed === false) &&
      invariants.some((item) => item.payload?.passed === true) &&
      String(attack?.payload?.status) === "resolved",
    `${invariants.length} 条不变量，攻击状态 ${attack?.payload?.status}`,
  )

  const harness = of("skill.harness").at(-1)
  check("MCP 技能验毒", Number(harness?.payload?.passed) === 3 && Number(harness?.payload?.failed) === 0, `3/3 通过`)

  const roles = of("role.run.finished")
  check("三角色真实并发", roles.length === 3, `${roles.length} 个角色完成`)

  const cruiseError = of("cruise.error").at(-1)
  check("巡航未执行时诚实阻断", Boolean(cruiseError) && /Playwright/.test(String(cruiseError?.payload?.message)), String(cruiseError?.payload?.message ?? "缺少 cruise.error"))

  const delivery = of("delivery.report").at(-1)
  const approvalStat = delivery?.payload?.stats?.find((item: any) => item.label === "人工介入")
  check(
    "交付报告不吞掉未验证项",
    delivery?.payload?.verified === false &&
      Array.isArray(delivery?.payload?.blocked) &&
      delivery.payload.blocked.length === 1 &&
      Number(approvalStat?.value) === 2 &&
      delivery?.payload?.approvals?.length === 2,
    `verified=${delivery?.payload?.verified}，阻断 ${delivery?.payload?.blocked?.length} 项，人工介入 ${approvalStat?.value}`,
  )

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const stream = await fetch(`${base}/api/runtime/tasks/${taskId}/events`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    })
    const reader = stream.body?.getReader()
    const first = reader ? await reader.read() : null
    const text = first?.value ? new TextDecoder().decode(first.value) : ""
    check("SSE 事件流可订阅", stream.status === 200 && /connected|data:/.test(text), text.trim().split("\n")[0] ?? "")
    controller.abort()
  } catch {
    check("SSE 事件流可订阅", false, "连接失败或超时")
  } finally {
    clearTimeout(timer)
  }
}

try {
  await main()
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
for (const item of checks) {
  console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}  —  ${item.detail}`)
}
console.log(`\n${passed}/${checks.length} 项通过`)
if (passed !== checks.length) {
  console.log("\n最近的服务器日志：")
  console.log(log.join("").split(/\r?\n/).slice(-20).join("\n"))
  process.exitCode = 1
} else {
  console.log("E2E 验收通过：十工段全链路、契约、审批、权限、台账与诚实阻断均已验证。")
}
