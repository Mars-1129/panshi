import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import { ArtifactSchema, StageRunSchema, type Artifact, type ArtifactKind, type StageRun } from "../../../shared/contracts.ts"
import { ensureDir, readJsonFileOrNull } from "../fs-utils.ts"

const EXT: Record<string, string> = { schema: ".sql", openapi: ".yaml", "component-tree": ".json", report: ".json", code: ".txt", skillpack: ".md", evidence: ".json", other: ".txt" }

export class FactoryStore {
  readonly runDir: string

  constructor(runDir: string) {
    this.runDir = runDir
  }

  async init(): Promise<void> {
    await ensureDir(this.stagesRoot())
    await ensureDir(this.artifactsRoot())
  }

  stagesRoot(): string { return join(this.runDir, "stages") }
  artifactsRoot(): string { return join(this.runDir, "artifacts") }
  contractsRoot(): string { return join(this.runDir, "contracts") }
  generatedRoot(): string { return join(this.runDir, "generated") }
  workspaceRoot(): string { return join(this.runDir, "workspace") }

  stageDir(stage: number): string {
    return join(this.stagesRoot(), String(stage).padStart(2, "0"))
  }

  async readStage(stage: number): Promise<StageRun | null> {
    return readJsonFileOrNull(join(this.stageDir(stage), "stage.json"), StageRunSchema)
  }

  async listStages(): Promise<StageRun[]> {
    const out: StageRun[] = []
    for (let stage = 0; stage <= 9; stage += 1) {
      const run = await this.readStage(stage)
      if (run) out.push(run)
    }
    return out
  }

  async writeStage(run: StageRun): Promise<void> {
    const dir = this.stageDir(run.stage)
    await ensureDir(dir)
    await writeFile(join(dir, "stage.json"), JSON.stringify(run, null, 2), "utf8")
  }

  /** 写入产物：内容落盘 + meta.json，返回可被前端消费的 Artifact。 */
  async saveArtifact(input: {
    taskId: string
    stage: number
    name: string
    kind: ArtifactKind
    content: string | Buffer
    producedBy?: string
  }): Promise<Artifact> {
    const hash = createHash("sha256").update(input.content).digest("hex")
    // 同一份内容可能以不同文件名/工段产出（如 schema.sql 与 db-schema.sql）；id 需要带上身份，否则会互相覆盖。
    const artifactId = `art_${createHash("sha256").update(`${input.stage}:${input.name}:${hash}`).digest("hex").slice(0, 12)}`
    const dir = join(this.artifactsRoot(), artifactId)
    await ensureDir(dir)
    const raw = basename(input.name)
    const ext = extname(raw) || EXT[input.kind] || ".txt"
    const fileName = extname(raw) ? raw : `${raw}${ext}`
    const body = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content, "utf8")
    await writeFile(join(dir, fileName), body)
    const artifact: Artifact = {
      artifactId,
      taskId: input.taskId,
      stage: input.stage,
      name: input.name,
      kind: input.kind,
      hash,
      bytes: body.byteLength,
      path: join(dir, fileName),
      producedBy: input.producedBy ?? "stage-runner",
      createdAt: new Date().toISOString(),
    }
    await writeFile(join(dir, "meta.json"), JSON.stringify(artifact, null, 2), "utf8")
    return ArtifactSchema.parse(artifact)
  }

  async readArtifact(artifactId: string): Promise<{ artifact: Artifact; content: string } | null> {
    if (!/^art_[a-f0-9]{12}$/.test(artifactId)) return null
    const dir = join(this.artifactsRoot(), artifactId)
    const artifact = await readJsonFileOrNull(join(dir, "meta.json"), ArtifactSchema)
    if (!artifact) return null
    const content = await readFile(artifact.path, "utf8")
    return { artifact, content }
  }

  async listArtifacts(): Promise<Artifact[]> {
    let entries: string[] = []
    try {
      entries = await readdir(this.artifactsRoot())
    } catch {
      return []
    }
    const out: Artifact[] = []
    for (const entry of entries) {
      const artifact = await readJsonFileOrNull(join(this.artifactsRoot(), entry, "meta.json"), ArtifactSchema)
      if (artifact) out.push(artifact)
    }
    return out.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  async writeJson(name: string, value: unknown): Promise<string> {
    const dir = join(this.runDir, "reports")
    await ensureDir(dir)
    const path = join(dir, name)
    await writeFile(path, JSON.stringify(value, null, 2), "utf8")
    return path
  }
}

/** 工段 → 期望产物（用于前端"契约要求"与交付核对）。 */
export const STAGE_EXPECTED: Record<number, string[]> = {
  0: ["ProjectManifest", "BaselineSnapshot", "SecretScanReport", "EnvironmentSummary"],
  1: ["EnvironmentDiagnosis", "DependencyConflict[]", "FixDiff", "BuildLog", "RunVerdict"],
  2: ["CodeSlice[]", "CallGraph", "BusinessRule[]", "RuleEvidence[]", "UnanalyzedArea[]"],
  3: ["SymbolReport", "DecompiledSource", "DifferentialCase[]", "EquivalenceReport"],
  4: ["SkillManifest", "SKILL.md", "wrapper", "SkillHarnessReport"],
  5: ["schema.sql", "openapi.yaml", "component_tree.json", "ContractValidation"],
  6: ["RoleRun[]", "MergeReport"],
  7: ["RailViolation[]", "RailStats"],
  8: ["AttackReport", "InvariantResult[]", "RepairDiff", "ReplayReport"],
  9: ["DeliveryReport", "EvolutionPack", "SkillHubPullRequestDraft"],
}

export async function ensureFactoryDirs(store: FactoryStore): Promise<void> {
  await mkdir(store.contractsRoot(), { recursive: true })
  await mkdir(store.generatedRoot(), { recursive: true })
}
