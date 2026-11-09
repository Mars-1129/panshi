import { appendFile, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { FactoryPipeline } from "../../server/core/factory/pipeline.ts"
import { CommandRunner } from "../../server/core/command-runner.ts"
import { Git } from "../../server/core/git.ts"
import { DEFAULT_LIMITS } from "../../server/core/config.ts"
import { createTempRepo, type TempRepo } from "../helpers/repo.ts"
import type { FactoryEventType } from "../../shared/contracts.ts"
import { FactoryEventTypeSchema } from "../../shared/contracts.ts"

type Emitted = { type: string; payload: Record<string, unknown> }

describe("factory pipeline", () => {
  let repo: TempRepo
  let runRoot: string
  let emitted: Emitted[]
  let seq = 0

  beforeAll(async () => {
    repo = await createTempRepo({
      files: {
        "package.json": `${JSON.stringify({ name: "legacy-procurement", version: "1.0.0", scripts: { test: "node test.mjs" } }, null, 2)}\n`,
        "src/pricing.mjs": [
          "export function approve(amount, urgent) {",
          "  if (amount >= 500000 && urgent) { return 'vp' }",
          "  if (amount > 0) { return 'manager' }",
          "  return 'clerk'",
          "}",
          "const sql = 'SELECT id FROM procurement_order WHERE status = 1'",
          "",
        ].join("\n"),
        "README.md": "legacy procurement system\n",
        "test.mjs": 'console.log("ok")\n',
      },
    })
    runRoot = await mkdtemp(join(tmpdir(), "panshi-run-"))
    emitted = []
  }, 60_000)

  afterAll(async () => {
    await repo.cleanup()
    await rm(runRoot, { recursive: true, force: true, maxRetries: 5 })
  })

  function pipeline(): FactoryPipeline {
    const runner = new CommandRunner()
    return new FactoryPipeline({
      taskId: "task_factory_test",
      runDir: runRoot,
      repoRoot: repo.root,
      runner,
      git: new Git(runner),
      limits: DEFAULT_LIMITS,
      emit: async (type, payload) => {
        emitted.push({ type, payload })
        seq += 1
        await appendFile(join(runRoot, "events.jsonl"), JSON.stringify({ seq, runId: "run_factory_test", taskId: "task_factory_test", time: new Date().toISOString(), type, payload }) + "\n", "utf8")
      },
    })
  }

  it("emits only schema-valid factory event types", () => {
    const result = FactoryEventTypeSchema.safeParse("stage.completed")
    expect(result.success).toBe(true)
    expect(FactoryEventTypeSchema.safeParse("not.an.event").success).toBe(false)
  })

  it("stage 0 produces manifest, secret scan and environment artifacts", async () => {
    const run = await pipeline().runStage(0)
    expect(run.status).toBe("succeeded")
    expect(run.artifacts.map((item) => item.name)).toEqual(expect.arrayContaining(["project-manifest.json", "secret-scan.json", "environment.json"]))
    expect(emitted.some((item) => item.type === "baseline.secretScan")).toBe(true)
    expect(emitted.some((item) => item.type === "stage.completed" && item.payload.stageId === 0)).toBe(true)
  }, 60_000)

  it("stage 2 extracts rules with file and line evidence", async () => {
    const run = await pipeline().runStage(2)
    expect(run.status).toBe("succeeded")
    const ruleEvent = emitted.find((item) => item.type === "archaeology.rule")
    expect(ruleEvent).toBeTruthy()
    const rules = (ruleEvent?.payload.rules ?? []) as Array<{ path: string; line: number; kind: string }>
    expect(rules.length).toBeGreaterThan(0)
    expect(rules[0]?.path).toContain("src/pricing.mjs")
    expect(rules[0]?.line).toBeGreaterThan(0)
  }, 60_000)

  it("stage 5 refuses to lock without explicit confirmation", async () => {
    const run = await pipeline().runStage(5, { confirm: false }).catch((error: unknown) => error)
    expect(run).toBeInstanceOf(Error)
    expect(String((run as Error).message)).toContain("confirm")
  })

  it("stage 5 generates and validates the three contracts", async () => {
    const run = await pipeline().runStage(5, { confirm: true })
    expect(run.status).toBe("succeeded")
    expect(run.artifacts.map((item) => item.name)).toEqual(expect.arrayContaining(["schema.sql", "openapi.yaml", "component_tree.json"]))
    const locked = emitted.find((item) => item.type === "contract.locked")
    expect(locked?.payload.hash).toBeTruthy()
  }, 60_000)

  it("stage 6 runs three roles and merges their output", async () => {
    const run = await pipeline().runStage(6, { confirm: true })
    expect(run.status).toBe("succeeded")
    expect(emitted.filter((item) => item.type === "role.run.finished")).toHaveLength(3)
    const merge = emitted.find((item) => item.type === "role.merge")
    const merged = (merge?.payload.mergedFiles ?? []) as string[]
    expect(merged.length).toBeGreaterThanOrEqual(6)
  }, 60_000)

  it("stage 7 blocks the judge from reading implementation source", async () => {
    const run = await pipeline().runStage(7)
    expect(run.status).toBe("succeeded")
    const blocked = emitted.filter((item) => item.type === "rail.violation").map((item) => item.payload.railName)
    expect(blocked).toContain("ForbiddenMemoryRail")
  }, 60_000)

  it("stage 1 runs a real build attempt in an isolated copy", async () => {
    const run = await pipeline().runStage(1)
    expect(run.status).toBe("succeeded")
    expect(emitted.some((item) => item.type === "greenbuild.diagnosis")).toBe(true)
    expect(run.artifacts.map((item) => item.name)).toEqual(expect.arrayContaining(["environment-diagnosis.md", "run-verdict.json"]))
  }, 90_000)

  it("stage 4 converts a local MCP tool and passes its harness", async () => {
    const run = await pipeline().runStage(4)
    expect(run.status).toBe("succeeded")
    const harness = emitted.find((item) => item.type === "skill.harness")
    expect(harness?.payload.passed).toBe(3)
    expect(harness?.payload.failed).toBe(0)
  }, 90_000)

  it("stage 8 reproduces the oversell attack and verifies the repair", async () => {
    const run = await pipeline().runStage(8)
    expect(run.status).toBe("succeeded")
    const invariants = emitted.filter((item) => item.type === "judge.invariant")
    expect(invariants.some((item) => item.payload.passed === false)).toBe(true)
    expect(invariants.some((item) => item.payload.passed === true)).toBe(true)
  }, 120_000)


  it("stage 5 records the human approval and a clickable prototype", async () => {
    const run = await pipeline().runStage(5, { confirm: true })
    expect(run.artifacts.map((item) => item.name)).toContain("prototype.html")
    const approved = emitted.filter((item) => item.type === "approval.resolved" && Number(item.payload.stage) === 5)
    expect(approved.length).toBeGreaterThan(0)
    expect(emitted.some((item) => item.type === "prototype.ready")).toBe(true)
  }, 60_000)

  it("stage 7 reports rail statistics", async () => {
    const run = await pipeline().runStage(7)
    expect(run.status).toBe("succeeded")
    const stats = emitted.filter((item) => item.type === "rail.stats").pop()
    expect(Number(stats?.payload.rails)).toBe(7)
    expect(Number(stats?.payload.checks)).toBeGreaterThan(0)
  }, 60_000)

  it("stage 8 verifies the generated routes against the contract RBAC", async () => {
    const run = await pipeline().runStage(8)
    expect(run.status).toBe("succeeded")
    const permission = emitted.filter((item) => item.type === "judge.permission").pop()
    const checks = (permission?.payload.checks ?? []) as Array<{ passed: boolean }>
    expect(checks.length).toBeGreaterThan(0)
    expect(checks.every((item) => item.passed)).toBe(true)
  }, 120_000)

  it("stage 9 links approvals and a source ledger into the delivery report", async () => {
    const run = await pipeline().runStage(9)
    expect(run.status).toBe("succeeded")
    expect(run.artifacts.map((item) => item.name)).toContain("source-ledger.json")
    const ledger = emitted.filter((item) => item.type === "source.ledger").pop()
    expect(Number(ledger?.payload.total)).toBeGreaterThanOrEqual(3)
    const report = emitted.filter((item) => item.type === "delivery.report").pop()
    const approvals = (report?.payload.approvals ?? []) as unknown[]
    expect(approvals.length).toBeGreaterThanOrEqual(2)
  }, 60_000)

  it("stage 9 aggregates a delivery report and an evolution pack", async () => {
    const run = await pipeline().runStage(9)
    expect(run.status).toBe("succeeded")
    expect(run.artifacts.map((item) => item.name)).toEqual(expect.arrayContaining(["delivery-report.json", "evolution-skillpack.md", "skillhub-pr.md"]))
    expect(emitted.some((item) => item.type === "delivery.report")).toBe(true)
  }, 60_000)
})
