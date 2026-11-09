import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Archive, ArrowRight, Bell, Binary, Blocks, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDashed, CircleHelp, Compass, Copy, Database,
  Eye, FilePlus2, FileSignature, Gauge, GitCommitHorizontal, GitPullRequest, HeartPulse, Inbox,
  FolderOpen,
  ListTree,
  Minus,
  Link2, LoaderCircle, LockKeyhole, MessagesSquare, Menu, MonitorSmartphone, Moon, PackageCheck,
  PlugZap, Puzzle, ReceiptText, RefreshCw, Rocket, Scale, Search, Send, Server, ShieldCheck,
  Bot,
  Sparkles,
  ShieldPlus, Sprout, Sun, Sword, Swords, Table, TerminalSquare, TriangleAlert, Users, Workflow, X,
} from "lucide-react"
import type { AgentEvent, ConnectionState, Health, RepoSummary, ServerTask, TaskMode, Theme } from "./types"
import { ApiError, configureAi, createRuntimeProject, deleteRuntimeProject, getAiStatus, clearAi, type AiStatus, listRuntimeProjects, openRuntimeRepo, createRuntimeTask, fetchRuntimeEvents, getRuntimeTask, listRuntimeTasks, runtimeHealth, runtimeRepo, runFactoryAll, runFactoryStage, subscribeRuntimeEvents, type EventSubscription } from "./runtime"
import { mergeEvents } from "./lib/view-model"
import { ANCHOR_ORDER, RAIL_ORDER, ROLE_ORDER, STAGES, STAGE_ARTIFACTS, STAGE_GUIDE, STAGE_STEPS, type AdversarialBoard, type ApprovalRecord, type CruiseView, type FactorySource, type PanshiAnchorId, type PermissionView, type RailStatsView, type PrototypeView, type RailViolation, type RoleView, type SourceLedgerView, type StageId, type StageStatus, type StageVerdict, type StageView } from "./view-model/factory-types"
import { mapAdversarial, mapAllStages, mapApprovals, mapCruise, mapDelivery, mapPermission, mapPrototype, mapRailStats, mapRailViolations, mapStageVerdict, mapRoles, mapSourceLedger, stageProgress } from "./view-model/mappers"
import { ArtifactsDialog, ContractsDialog, HelpDialog } from "./components/Dialogs"
import { ProjectWizard, type ProjectDraftPayload } from "./components/ProjectWizard"
import { AiDialog } from "./components/AiDialog"
import { EvidenceDrawer } from "./components/EvidenceDrawer"
import { Seal } from "./components/Seal"
import { ProjectsDialog } from "./components/ProjectsDialog"
import { artifactLabel, eventLabel, railLabel, roleLabel } from "./i18n"

const PHASES: Array<{ id: string; label: string; short: string; stages: StageId[] }> = [
  { id: "S1", label: "接入与解构", short: "解构", stages: [0, 1, 2, 3] },
  { id: "S2", label: "原型与契约", short: "契约", stages: [4, 5] },
  { id: "S3", label: "并发制造", short: "制造", stages: [6] },
  { id: "S4", label: "红蓝质检", short: "质检", stages: [7, 8] },
  { id: "S5", label: "交付沉淀", short: "交付", stages: [9] },
]

const ROLE_ICONS: Record<string, string> = {}
ROLE_ORDER.forEach((item) => { ROLE_ICONS[item.role] = item.icon })

function RoleGlyph({ role }: { role: string }) {
  if (role === "Chief Architect" || role === "Contract Builder") {
    return <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" fill="rgba(245,158,11,0.14)" stroke="#F59E0B" strokeWidth="1.6" /><polygon points="12 6 17 9 17 15 12 18 7 15 7 9 12 6" fill="rgba(6,182,212,0.2)" stroke="#06B6D4" strokeWidth="1.4" /><circle cx="12" cy="12" r="1.8" fill="#F8FAFC" /></svg>
  }
  if (role === "Judge") {
    return <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(67,56,202,0.12)" stroke="#4338CA" strokeWidth="1.7" /><path d="M7 11h10M9 14l6-6" stroke="#4338CA" strokeWidth="1.5" strokeLinecap="round" /></svg>
  }
  if (role === "Red Agent") {
    return <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="rgba(220,38,38,0.14)" stroke="#DC2626" strokeWidth="1.7" /></svg>
  }
  if (role === "Blue Agent") {
    return <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" fill="rgba(2,132,199,0.12)" stroke="#0284C7" strokeWidth="1.6" /><path d="M8 11V7a4 4 0 018 0v4" stroke="#0284C7" strokeWidth="1.6" /><circle cx="12" cy="16" r="1.5" fill="#0284C7" /></svg>
  }
  return I({ name: ROLE_ICONS[role], size: 16 })
}

function BrandMark() {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" fill="rgba(245,158,11,0.14)" stroke="#F59E0B" strokeWidth="1.6" />
    <polygon points="12 6 17 9 17 15 12 18 7 15 7 9 12 6" fill="rgba(6,182,212,0.2)" stroke="#06B6D4" strokeWidth="1.4" />
    <circle cx="12" cy="12" r="2" fill="#F8FAFC" />
  </svg>
}

function I({ name, size = 17 }: { name: string; size?: number }) {
  const p = { size, strokeWidth: 2, "aria-hidden": true as const }
  const m: Record<string, ReactNode> = {
    Archive: <Archive {...p} />, Binary: <Binary {...p} />, Blocks: <Blocks {...p} />, Boxes: <Boxes {...p} />,
    Check: <Check {...p} />, CircleDashed: <CircleDashed {...p} />, Compass: <Compass {...p} />, Database: <Database {...p} />,
    Eye: <Eye {...p} />, FilePlus2: <FilePlus2 {...p} />, FileSignature: <FileSignature {...p} />, Gauge: <Gauge {...p} />,
    GitCommitHorizontal: <GitCommitHorizontal {...p} />, GitPullRequest: <GitPullRequest {...p} />, HeartPulse: <HeartPulse {...p} />,
    Inbox: <Inbox {...p} />, Link2: <Link2 {...p} />, LoaderCircle: <LoaderCircle {...p} />, LockKeyhole: <LockKeyhole {...p} />,
    MessagesSquare: <MessagesSquare {...p} />, Menu: <Menu {...p} />, MonitorSmartphone: <MonitorSmartphone {...p} />,
    Moon: <Moon {...p} />, PackageCheck: <PackageCheck {...p} />, PlugZap: <PlugZap {...p} />, Puzzle: <Puzzle {...p} />,
    ReceiptText: <ReceiptText {...p} />, RefreshCw: <RefreshCw {...p} />, Rocket: <Rocket {...p} />, Scale: <Scale {...p} />,
    Search: <Search {...p} />, Send: <Send {...p} />, Server: <Server {...p} />, ShieldCheck: <ShieldCheck {...p} />,
    ShieldPlus: <ShieldPlus {...p} />, Sprout: <Sprout {...p} />, Sun: <Sun {...p} />, Sword: <Sword {...p} />,
    Swords: <Swords {...p} />, Table: <Table {...p} />, TriangleAlert: <TriangleAlert {...p} />, Users: <Users {...p} />,
    Workflow: <Workflow {...p} />, X: <X {...p} />, Bell: <Bell {...p} />,
  }
  return m[name] ?? <CircleDashed {...p} />
}

function phaseState(phase: { stages: StageId[] }, stages: Array<{ stage: StageId; status: StageStatus }>): "done" | "running" | "blocked" | "idle" {
  const items = stages.filter((stage) => phase.stages.includes(stage.stage))
  if (items.some((stage) => stage.status === "blocked" || stage.status === "failed")) return "blocked"
  if (items.every((stage) => stage.status === "done")) return "done"
  if (items.some((stage) => stage.status === "active")) return "running"
  return "idle"
}

function statusClass(status: StageStatus): string {
  // 未执行的工段也要有 class：样式里已有 .stage-item.stage-pending 的弱化规则，
  // 之前这里返回空串，那条规则永远不会命中。
  if (status === "not_applicable") return "stage-na"
  return status === "done" ? "stage-done" : status === "active" ? "stage-active" : status === "failed" ? "stage-failed" : status === "blocked" ? "stage-blocked" : "stage-pending"
}
function statusLabel(status: StageStatus): string {

  return status === "done" ? "已完成" : status === "active" ? "执行中" : status === "failed" ? "失败" : status === "blocked" ? "阻断" : "待接入"
}
function verdictLabel(status: StageStatus): string {
  if (status === "done") return "通过"
  if (status === "blocked") return "阻断"
  if (status === "failed") return "失败"
  if (status === "active") return "执行中"
  if (status === "not_applicable") return "不适用"
  return "待运行"
}

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "请求失败"
}
function terminal(status: ServerTask["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled"
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem("rp-theme") === "dark" ? "dark" : "light")
  const [stageId, setStageId] = useState<StageId>(0)
  const [view, setView] = useState<"overview" | "stage">("overview")
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading")
  const [reachable, setReachable] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [repo, setRepo] = useState<RepoSummary | null>(null)
  const [tasks, setTasks] = useState<ServerTask[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connection, setConnection] = useState<ConnectionState>("snapshot")
  const [error, setError] = useState<string | null>(null)
  const [railOpen, setRailOpen] = useState(false)
  const [composer, setComposer] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [projects, setProjects] = useState<Array<{ id: string; product: string; path: string }>>([])
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [artifactsOpen, setArtifactsOpen] = useState(false)
  const [contractsOpen, setContractsOpen] = useState(false)
  const [helpTab, setHelpTab] = useState<"guide" | "backend" | null>(null)
  const [runArmed, setRunArmed] = useState<number | null>(null)
  const [runPending, setRunPending] = useState<number | null>(null)
  const [anchor, setAnchor] = useState<PanshiAnchorId>("procurement.table")
  const [invoiceBlocked, setInvoiceBlocked] = useState(false)
  const [submitConfirm, setSubmitConfirm] = useState(false)
  const [toasts, setToasts] = useState<Array<{ id: number; tone: "ok" | "warn" | "danger" | "info"; title: string; detail: string }>>([])
  const toastSeq = useRef(0)
  const subscriptions = useRef(new Map<string, EventSubscription>())
  // boot 在空依赖 effect 里跑，闭包里的 activeId 永远是首帧值；用 ref 跟随最新值。
  const activeIdRef = useRef<string | null>(null)
  // 已装载事件的任务 id：用来识别「换任务了」，在 loadTask 里做一次性清理。
  const loadedTaskRef = useRef<string | null>(null)
  const task = tasks.find((item) => item.id === activeId) ?? null
  const source: FactorySource = useMemo(() => ({ task, events, repo, runtimeReachable: reachable }), [task, events, repo, reachable])
  const stages = useMemo(() => mapAllStages(source, stageId), [source, stageId])
  const activePhase = view === "stage" ? PHASES.find((phase) => phase.stages.includes(stageId))?.id ?? null : null
  const selected = stages.find((item) => item.stage === stageId) ?? stages[0]

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem("rp-theme", theme)
  }, [theme])
  useEffect(() => {
    void boot()
    return () => subscriptions.current.forEach((item) => item.close())
  }, [])
  // 只同步 ref，不在这里清理事件：boot 里 setActiveId 之后紧接着 await loadTask，
  // 若在这里清空会把刚加载好的事件又擦掉。真正的切换清理放在 loadTask 开头。
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setComposer(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function pushToast(tone: "ok" | "warn" | "danger" | "info", title: string, detail = ""): void {
    const id = (toastSeq.current += 1)
    setToasts((current) => [...current, { id, tone, title, detail }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200)
  }

  function dismissToast(id: number): void {
    setToasts((current) => current.filter((item) => item.id !== id))
  }

  async function boot() {
    setLoad("loading")
    try {
      const [h, r, list, projectList, ai] = await Promise.all([runtimeHealth(), runtimeRepo(), listRuntimeTasks(), listRuntimeProjects().catch(() => ({ projects: [], root: "" })), getAiStatus().catch(() => null)])
      setAiStatus(ai)
      // reachable 表达的是「本地运行时连得上」。这五个请求都成功返回，运行时就是可达的；
      // 之前赋成 h.repoReady，导致仓库还没就绪时整页误报 OFFLINE。
      setHealth(h); setRepo(r.summary); setReachable(true); setTasks(list.tasks); setProjects(projectList.projects)
      // boot 是空依赖 effect 里调用的，闭包里的 activeId 永远是首帧的 null；
      // 用 ref 读当前值，刷新后才能恢复上次选中的任务。
      const current = activeIdRef.current
      const id = current && list.tasks.some((item) => item.id === current) ? current : list.tasks[0]?.id ?? null
      setActiveId(id)
      if (id) await loadTask(id)
      setLoad("ready")
    } catch (e) {
      setReachable(false); setLoad("error"); setError(message(e))
    }
  }
  async function loadTask(id: string) {
    try {
      // 真正的任务切换发生在这里：关掉其它任务的订阅并清空上一任务的事件。
      // 不关会累积连接（服务端 SSE 上限 32 条，超出返回 429）；
      // 不清会让 A 任务的事件点亮 B 任务的工段（事件本身不带 taskId）。
      if (loadedTaskRef.current !== id) {
        for (const [other, sub] of subscriptions.current) {
          if (other === id) continue
          sub.close()
          subscriptions.current.delete(other)
        }
        setEvents([])
        loadedTaskRef.current = id
      }
      const next = (await getRuntimeTask(id)).task
      setTasks((current) => current.map((item) => item.id === id ? next : item))
      // 合并而不是整体替换：抓取窗口内已到达的 SSE 事件不会被这次快照覆盖掉。
      const fetched = (await fetchRuntimeEvents(id, 0)).events
      setEvents((current) => (current.length > 0 ? mergeEvents(current, fetched) : fetched))
      if (terminal(next.status)) setConnection("snapshot"); else attach(id)
    } catch (e) { setError(message(e)) }
  }
  function attach(id: string) {
    if (subscriptions.current.has(id)) return
    setConnection("connecting")
    const sub = subscribeRuntimeEvents(id, 0, (event) => {
      setEvents((current) => current.some((item) => item.seq === event.seq) ? current : mergeEvents(current, [event]))
      if (event.type === "stage.completed" || event.type === "stage.failed") {
        const finishedStage = Number((event.payload as Record<string, unknown>).stageId)
        if (Number.isInteger(finishedStage)) setRunPending((current) => (current === finishedStage ? null : current))
      }
      if (event.type !== "system.note" && event.type !== "tool.started") void refresh(id)
      if (event.type === "run.succeeded" || event.type === "run.failed" || event.type === "run.cancelled") {
        sub.close(); subscriptions.current.delete(id); setConnection("snapshot")
      }
    }, (state) => { setConnection(state); if (state === "live") void refresh(id) })
    subscriptions.current.set(id, sub)
  }
  async function refresh(id: string) {
    try {
      const next = (await getRuntimeTask(id)).task
      setTasks((current) => current.map((item) => item.id === id ? next : item))
    } catch (e) { setError(message(e)) }
  }
  async function startRun(stage: number): Promise<void> {
    if (!activeId) {
      setComposer(true)
      pushToast("info", "先创建一次运行", "工厂工段需要挂在一个任务上。")
      return
    }
    const writes = stage === 0 || stage === 5 || stage === 6
    if (writes && runArmed !== stage) {
      setRunArmed(stage)
      pushToast("info", "需要二次确认", stage === 0 ? "全链路会生成契约与代码；再次点击确认执行。" : "该工段会写文件；再次点击确认执行。")
      return
    }
    setRunArmed(null)
    setRunPending(stage)
    try {
      if (stage === 0) await runFactoryAll(activeId, true)
      else await runFactoryStage(activeId, stage, writes)
      pushToast("ok", `工段 ${String(stage).padStart(2, "0")} 已启动`, "结果会通过事件流实时更新。")
    } catch (error) {
      setRunPending(null)
      pushToast("danger", "无法启动工段", message(error))
    }
  }

  async function runCurrent(): Promise<void> {
    if (!health?.repoReady) {
      pushToast("warn", "工作区不可用", health?.repoError ?? "请先选择一个 Git 仓库")
      return
    }
    try {
      const next = await createRuntimeTask({ title: "体验运行", summary: "在当前工作区跑通十工段", mode: "generate" as TaskMode })
      setTasks((current) => [next.task, ...current.filter((item) => item.id !== next.task.id)])
      setActiveId(next.task.id)
      setEvents([])
      setStageId(0)
      attach(next.task.id)
      await loadTask(next.task.id)
      await runFactoryAll(next.task.id, true)
      pushToast("ok", "十工段已启动", "左侧工段会依次点亮；阻断项会如实显示。")
    } catch (error) {
      pushToast("danger", "无法启动运行", message(error))
    }
  }

  async function openProject(path: string): Promise<void> {
    try {
      await openRuntimeRepo(path)
      setActiveId(null)
      setEvents([])
      setTasks([])
      setStageId(0)
      await boot()
      pushToast("ok", "已切换项目", path)
    } catch (error) {
      pushToast("danger", "无法打开项目", message(error))
    }
  }

  async function handleDeleteProject(id: string): Promise<void> {
    try {
      await deleteRuntimeProject(id)
      const list = await listRuntimeProjects()
      setProjects(list.projects)
      pushToast("ok", "项目已删除", id)
    } catch (error) {
      pushToast("danger", "无法删除项目", message(error))
      throw error
    }
  }

  async function handleCreateProject(draft: ProjectDraftPayload): Promise<void> {
    const created = await createRuntimeProject(draft)
    setWizardOpen(false)
    pushToast("ok", "项目已创建", created.project.path)
    try {
      setActiveId(null)
      setEvents([])
      setTasks([])
      setStageId(0)
      await boot()
      const next = await createRuntimeTask({ title: draft.product, summary: draft.description, mode: "generate" as TaskMode })
      setTasks((current) => [next.task, ...current.filter((item) => item.id !== next.task.id)])
      setActiveId(next.task.id)
      setEvents([])
      setStageId(0)
      attach(next.task.id)
      await loadTask(next.task.id)
      await runFactoryAll(next.task.id, true)
      pushToast("ok", "十工段已启动", "左侧工段会依次点亮；阻断项会如实显示。")
    } catch (error) {
      pushToast("danger", "项目已创建，但运行未启动", message(error))
    }
  }

  async function createTask(title: string, summary: string): Promise<string | null> {
    try {
      const next = (await createRuntimeTask({ title, summary, mode: "generate" as TaskMode })).task
      setTasks((current) => [next, ...current.filter((item) => item.id !== next.id)])
      setActiveId(next.id); setEvents([]); setStageId(5); attach(next.id); await loadTask(next.id)
      pushToast("ok", "运行已创建", "计划生成中；批准之前不会执行命令或写入文件。")
      return null
    } catch (e) {
      const failure = message(e)
      setError(failure)
      pushToast("danger", "创建运行失败", failure)
      return failure
    }
  }
  const progress = stageProgress(stages)
  const na = stages.filter((item) => item.status === "not_applicable").length
  const contractHash = (() => {
    for (let index = source.events.length - 1; index >= 0; index -= 1) {
      const event = source.events[index]
      if (event && event.type === "contract.locked") return String((event.payload as Record<string, unknown>).hash ?? "")
    }
    return ""
  })()
  const latest = source.events.at(-1)
  const latestStage = latest ? Number((latest.payload as Record<string, unknown>).stageId) : NaN
  const latestText = latest ? "最新 · " + (Number.isInteger(latestStage) ? "工段 " + String(latestStage).padStart(2, "0") + " · " : "") + eventLabel(latest.type) : "等待运行"
  const projectId = task?.id ?? repo?.name ?? "demo-project"
  const runId = task?.runId ?? "未运行"

  return <div className="factory-shell">
    <header className="factory-topbar gov-topbar">
      <div className="brand-block">
        <div className="factory-brand">
          <span className="brand-mark"><BrandMark /></span>
          <span className="brand-name">磐石智造</span>
          <span className="brand-sub">PanShi-SwarmFactory</span>
        </div>
        <div className="brand-meta"><span className={"brand-live" + (reachable ? "" : " is-offline")} /><span>{projectId}</span><i /><span>{runId}</span><i /><span className={"meta-state" + (reachable ? "" : " is-offline")}>{reachable ? connection.toUpperCase() : "OFFLINE"}</span></div>
      </div>
      <nav className="phase-nav" aria-label="五阶段流程">
        {PHASES.map((phase) => {
          const state = phaseState(phase, stages)
          return <button key={phase.id} className={"phase-step is-" + state + (activePhase === phase.id ? " is-current" : "")} type="button" onClick={() => { setStageId(phase.stages[0]); setView("stage") }}>
            <span className="phase-id">{phase.id}</span>
            <span className="phase-label">{phase.label}</span>
            {state === "done" ? <Check size={12} /> : null}
          </button>
        })}
      </nav>
      <div className="factory-actions">
        <button className="button button-quiet ai-chip" type="button" onClick={() => setAiOpen(true)}><Bot size={14} />{aiStatus?.configured ? "AI · " + String(aiStatus.model).split("/").pop() : "AI 未接入"}</button>
        <button className="button button-quiet" type="button" onClick={() => setView("overview")}><Compass size={15} />概览</button>
        <button className="button button-quiet" type="button" onClick={() => setProjectsOpen(true)}><FolderOpen size={15} />项目</button>
        <button className="button button-secondary factory-run-button" type="button" onClick={() => setWizardOpen(true)}><Sparkles size={15} /><span className="factory-run-label">新建项目</span></button>
        <button className="icon-button" type="button" title="使用引导与后端对接" aria-label="使用引导与后端对接" onClick={() => setHelpTab("guide")}><CircleHelp size={17} /></button>
        <button className="icon-button" type="button" title="通知中心" aria-label="通知中心" onClick={() => pushToast("info", "通知中心", "暂无通知：真实运行事件接入后在此展示。")}><Bell size={17} /></button>
        <button className="icon-button" type="button" title="打开工段导航" aria-label="打开工段导航" onClick={() => setRailOpen((value) => !value)}><Menu size={17} /></button>
        <button className="icon-button" type="button" title="切换明暗主题" aria-label="切换明暗主题" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}</button>
      </div>
    </header>
    <div className="factory-body">
      <aside className={"stage-rail" + (railOpen ? " is-rail-open" : "")} aria-label="工厂工段">
        <div className="rail-title">工厂工段 · 10 段</div>
        {stages.map((stage) => {
          const phase = PHASES.find((item) => item.stages[0] === stage.stage)
          return <Fragment key={stage.stage}>
            {phase ? <div className="rail-phase"><span>{phase.id}</span>{phase.label}<em className={"rail-phase-state is-" + phaseState(phase, stages)}>{phaseState(phase, stages) === "done" ? "完成" : phaseState(phase, stages) === "blocked" ? "阻断" : phaseState(phase, stages) === "running" ? "进行中" : "待开始"}</em></div> : null}
            <button className={"stage-item " + statusClass(stage.status) + (stage.selected ? " is-selected" : "")} type="button" title={"工段 " + String(stage.stage).padStart(2, "0") + " · " + stage.name} onClick={() => { setStageId(stage.stage); setView("stage") }}>
              <span className="stage-dot">{stage.status === "done" ? <Check size={14} /> : stage.status === "active" ? <LoaderCircle size={14} /> : stage.status === "failed" ? <X size={14} /> : stage.status === "blocked" ? <TriangleAlert size={14} /> : stage.status === "not_applicable" ? <Minus size={14} /> : <span>{String(stage.stage).padStart(2, "0")}</span>}</span>
              <span className="stage-copy"><span className="stage-name"><span className="stage-index">{String(stage.stage).padStart(2, "0")}</span>{stage.name}</span><span className="stage-sub">{stage.sub}</span></span>
            </button>
          </Fragment>
        })}
        <div className="stage-progress"><div className="progress-track"><div className="progress-fill" style={{ width: String(progress) + "%" }} /></div><div className="progress-label">可验证进度 {progress}% · {stages.filter((item) => item.status === "done").length}/{stages.filter((item) => item.status !== "not_applicable").length} 通过{na > 0 ? ` · ${na} 项不适用` : ""}</div></div>
      </aside>
      <main className="stage-view" id="main-content"><div className="stage-container">
        {load === "loading" && <div className="state-loading" aria-busy="true"><LoaderCircle className="spin" size={20} /><span>正在加载工厂基线和运行事件…</span></div>}
        {load === "error" && <div className="state-panel-error" role="alert"><TriangleAlert size={20} /><div><strong>无法连接本地运行时</strong><p>{error}</p></div><button className="button button-secondary" type="button" onClick={() => void boot()}><RefreshCw size={15} />重试连接</button></div>}
        {load === "ready" && error && <div className="action-error" role="alert"><TriangleAlert size={16} /><span>{error}</span><button className="icon-button" type="button" aria-label="关闭错误" onClick={() => setError(null)}><X size={15} /></button></div>}
        {load === "ready" && view === "overview" && <Overview repo={repo} tasks={tasks} stages={stages} source={source} aiStatus={aiStatus} projects={projects} aiConfigured={aiStatus?.configured === true} onCreate={() => setWizardOpen(true)} onOpenProjects={() => setProjectsOpen(true)} onOpenAi={() => setAiOpen(true)} onContinue={() => { setView("stage"); setStageId(0) }} onOpenProject={(path) => void openProject(path)} />}
        {load === "ready" && view === "stage" && tasks.length === 0 && selected?.stage === 0 && <Welcome repo={repo} projects={projects} onCreate={() => setWizardOpen(true)} onSample={runCurrent} onOpenProject={(path) => void openProject(path)} />}
        {load === "ready" && view === "stage" && selected && (tasks.length > 0 || selected.stage !== 0) && <div className="stage-enter" key={selected.stage}><StageWorkspace stage={selected} stages={stages} onSelectStage={setStageId} tasks={tasks} source={source} roles={mapRoles(source)} violations={mapRailViolations(source)} board={mapAdversarial(source)} cruise={mapCruise(source)} delivery={mapDelivery(source)} anchor={anchor} setAnchor={setAnchor} invoiceBlocked={invoiceBlocked} onOpenArtifacts={() => setArtifactsOpen(true)} onOpenContracts={() => setContractsOpen(true)} onOpenHelp={() => setHelpTab("guide")} onOpenWizard={() => setWizardOpen(true)} runPending={runPending} runArmed={runArmed} onRun={startRun} onInvoice={() => { setInvoiceBlocked(true); pushToast("warn", "Skill 尚未接入", "MCP Skill 后端未接入，本次调用未执行。") }} submitConfirm={submitConfirm} onSubmit={() => { setSubmitConfirm(true); pushToast("info", "需要二次确认", "写操作未执行：后端 RBAC 与审批服务尚未接入。") }} onCreateTask={() => setComposer(true)} /></div>}
      </div></main>
    </div>
    <footer className="factory-statusbar">
      <span className="sb-item"><span className="sb-seal">政企</span>PanShi-SwarmFactory · 软件工厂驾驶舱</span>
      <span className="sb-spacer" />
      <span className="sb-item sb-hide-sm"><b>仓库</b>{repo?.name ?? "未连接"}</span>
      <span className="sb-item"><span className={"sb-dot" + (reachable ? "" : " is-offline")} />{reachable ? "本地运行时已连接" : "本地运行时未连接"}</span>
      <span className="sb-item sb-ticker" title={latestText}><span className={"sb-dot" + (reachable ? " is-live" : "")} />{latestText}</span>
      <span className="sb-item"><b>视图</b>{view === "overview" ? "概览" : "工段 " + String(stageId).padStart(2, "0") + " / 10"}</span>
      <span className="sb-item sb-hide-sm"><b>契约</b>{contractHash ? contractHash.slice(0, 8) : "未锁定"}</span>
      <span className="sb-item"><b>可验证进度</b>{progress}%</span>
      <span className="sb-item sb-hide-sm"><kbd className="sb-key">Ctrl</kbd><kbd className="sb-key">K</kbd> 新建运行</span>
      <button className="sb-link" type="button" onClick={() => setHelpTab("guide")}>使用引导</button>
      <button className="sb-link" type="button" onClick={() => setHelpTab("backend")}>后端对接</button>
    </footer>
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((item) => <div className={"toast toast-" + item.tone} key={item.id}>
        <span className="toast-mark" aria-hidden="true">{item.tone === "ok" ? <Check size={15} /> : item.tone === "danger" ? <TriangleAlert size={15} /> : item.tone === "warn" ? <TriangleAlert size={15} /> : <CircleDashed size={15} />}</span>
        <div className="toast-copy"><strong>{item.title}</strong>{item.detail ? <span>{item.detail}</span> : null}</div>
        <button className="icon-button toast-close" type="button" aria-label="关闭提示" onClick={() => dismissToast(item.id)}><X size={14} /></button>
      </div>)}
    </div>
    {composer && <Composer onClose={() => setComposer(false)} onCreate={createTask} />}
      {wizardOpen && <ProjectWizard onClose={() => setWizardOpen(false)} onCreate={handleCreateProject} />}
      {aiOpen && <AiDialog status={aiStatus} onClose={() => setAiOpen(false)} onSave={async (input) => { const next = await configureAi(input); setAiStatus(next); pushToast("ok", "AI 已接入", next.model) }} onClear={async () => { const next = await clearAi(); setAiStatus(next); pushToast("info", "已移除 AI 配置", "工段将使用确定性回退") }} />}
      {projectsOpen && <ProjectsDialog projects={projects} currentPath={health?.repo ?? null} onOpen={(path) => { setProjectsOpen(false); void openProject(path) }} onDelete={handleDeleteProject} onNew={() => { setProjectsOpen(false); setWizardOpen(true) }} onClose={() => setProjectsOpen(false)} />}
    {artifactsOpen && selected && <ArtifactsDialog stage={selected} onClose={() => setArtifactsOpen(false)} />}
    {contractsOpen && <ContractsDialog taskId={task?.id} onClose={() => setContractsOpen(false)} />}
    {helpTab && <HelpDialog initialTab={helpTab} onClose={() => setHelpTab(null)} onSelectStage={(id) => setStageId(id)} onCreate={() => { setHelpTab(null); setComposer(true) }} />}
  </div>
}

function StageWorkspace(props: {
  stage: ReturnType<typeof mapAllStages>[number]; source: FactorySource; roles: RoleView[]; violations: RailViolation[]
  board: AdversarialBoard; cruise: CruiseView; delivery: ReturnType<typeof mapDelivery>
  anchor: PanshiAnchorId; setAnchor: (id: PanshiAnchorId) => void; invoiceBlocked: boolean; onInvoice: () => void; submitConfirm: boolean; onSubmit: () => void; onCreateTask: () => void
  stages: ReturnType<typeof mapAllStages>; onSelectStage: (id: StageId) => void; tasks: ServerTask[]
  onOpenArtifacts: () => void; onOpenContracts: () => void; onOpenHelp: () => void; onOpenWizard: () => void; runPending: number | null; runArmed: number | null; onRun: (stage: number) => void
}) {
  const n = props.stage.stage
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const verdict = mapStageVerdict(props.source, props.stage.stage)
  const next = (n + 1) % 10 as StageId
  const artifactCount = props.stage.inputs.length + props.stage.outputs.length
  const doneCount = props.stages.filter((item) => item.status === "done").length
  const blockedStages = props.stages.filter((item) => item.status === "blocked" || item.status === "failed").map((item) => ({ stage: item.stage, name: item.name, reason: blockedReason(props.source.events, item.stage) }))
  const totalArtifacts = props.stages.reduce((sum, item) => sum + item.outputs.length, 0)
  const progressPercent = Math.round((doneCount / Math.max(1, props.stages.length)) * 100)
  const highlights = collectHighlights(props.source.events)
  const approvals = mapApprovals(props.source)
  const ledger = mapSourceLedger(props.source)
  const permission = mapPermission(props.source)
  const railStats = mapRailStats(props.source)
  const prototype = mapPrototype(props.source)
  const prototypeReady = prototype.ready
  const builtinAnchors = new Set<string>(ANCHOR_ORDER.map((item) => String(item.id)))
  const customPrototype = prototype.anchors.length > 0 && prototype.anchors.some((anchor) => !builtinAnchors.has(anchor.id))
  const contract = (() => {
    for (let index = props.source.events.length - 1; index >= 0; index -= 1) {
      const event = props.source.events[index]
      if (event && event.type === "contract.locked") {
        const data = event.payload as Record<string, unknown>
        return { hash: String(data.hash ?? ""), version: Number(data.version ?? 1), lockedAt: String(data.lockedAt ?? "") }
      }
    }
    return { hash: "", version: 1, lockedAt: "" }
  })()
  const contractHash = contract.hash
  return <>
    <div className="stage-header">
      <div className="stage-head">
        <div className="stage-kicker"><span className="kicker-label">工段</span><span className="kicker-num">{String(n).padStart(2, "0")}</span><span className="kicker-sep">/</span><span className="kicker-total">10</span><span className="kicker-en">{props.stage.sub}</span></div>
        <h1 className="stage-title">{props.stage.name}</h1>
        <p className="stage-desc">{STAGES[n].desc}</p>
        <p className="stage-verdict"><span className={"verdict-pill is-" + verdict.status}>{verdictLabel(verdict.status)}</span><span className="verdict-text">{verdict.conclusion}</span><span className="verdict-meta">{verdict.durationMs !== null && verdict.durationMs >= 100 ? (verdict.durationMs / 1000).toFixed(1) + "s" : ""}{verdict.mode === "ai" ? " · AI" : verdict.mode === "deterministic" ? " · 确定性" : ""}</span></p>
        <p className="stage-next">{I({ name: "Compass", size: 13 })}<b>下一步</b>{STAGE_GUIDE[n]}</p>
      </div>
      <div className="stage-actions">
        <button className="button button-primary" type="button" disabled={props.runPending !== null} onClick={() => props.onRun(n)}>{props.runPending === n ? <LoaderCircle className="spin" size={15} /> : <Rocket size={15} />}{props.runArmed === n ? "确认执行（写文件）" : n === 0 ? "运行 MVP 全链路" : "运行本工段"}</button>
        <button className="button button-quiet" type="button" onClick={() => setEvidenceOpen(true)} title="查看本工段证据"><ListTree size={15} />证据</button>
        <button className="button button-quiet" type="button" onClick={props.onOpenArtifacts} title="查看本工段产物（弹窗）"><Boxes size={15} />产物{artifactCount > 0 ? <span className="count-pill">{artifactCount}</span> : null}</button>
        {n === 5 && <button className="button button-quiet" type="button" onClick={props.onOpenContracts}><FileSignature size={15} />契约</button>}
        <button className="button button-secondary" type="button" onClick={() => props.onSelectStage(next)}>下一工段<ArrowRight size={15} /></button>
      </div>
    </div>
    <div className="stage-body">
      {n === 0 && <div className="stage-zero">
        {props.tasks.length === 0 && <Onboard onOpenHelp={props.onOpenHelp} onOpenWizard={props.onOpenWizard} />}
        <RunHero
          task={props.source.task}
          done={doneCount}
          blocked={blockedStages}
          artifacts={totalArtifacts}
          events={props.source.events.length}
          progress={progressPercent}
          segments={props.stages.map((item) => item.status)}
          highlights={highlights}
          onOpenDelivery={() => props.onSelectStage(9)}
          onRun={() => props.onRun(0)}
          running={props.runPending !== null}
        />
        <WorkflowRibbon stages={props.stages} onSelect={props.onSelectStage} />
        <div className="panel-duo"><Baseline source={props.source} /><RecentRuns tasks={props.tasks} onCreate={props.onCreateTask} /></div>
      </div>}
      {n >= 1 && n <= 4 && <StagePlan stage={n} onOpenArtifacts={props.onOpenArtifacts} facts={buildStageFacts(n, props.source.events).facts} rules={buildStageFacts(n, props.source.events).rules} outputs={props.stage.outputs} exitCriteria={props.stage.exitCriteria} onNext={() => props.onSelectStage((n + 1) % 10 as StageId)} />}
      {n === 5 && (customPrototype ? <CustomPrototype prototype={prototype} /> : <Biz {...props} approvals={approvals} prototypeReady={prototypeReady} contractHash={contractHash} />)}
      {n === 6 && <Roles roles={props.roles} />}
      {n === 7 && <Rails violations={props.violations} stats={railStats} />}
      {n === 8 && <div className="stage-qa"><Adversarial board={props.board} permission={permission} /><Cruise cruise={props.cruise} /></div>}
      {n === 9 && <Delivery report={props.delivery} sources={ledger} approvals={approvals} contractHash={contractHash} contractVersion={contract.version} contractLockedAt={contract.lockedAt} />}
    </div>
    {evidenceOpen && <EvidenceDrawer stage={props.stage.stage} events={props.source.events} onClose={() => setEvidenceOpen(false)} />}
  </>
}
/** 首次使用引导条：可关闭，关闭状态写入 localStorage。 */
/** 首次进入：先讲清楚"这是什么、从哪里开始"，再进入十工段。 */
function factoryStatusLabel(factory: ServerTask["factory"]): string | null {
  if (!factory) return null
  if (factory.status === "succeeded") return "工厂已完成"
  if (factory.status === "failed") return "工厂失败"
  if (factory.status === "blocked") return `工厂阻断 ${factory.blocked}`
  if (factory.status === "running") return `工厂 ${factory.done}/${factory.total}`
  return "工厂未运行"
}

/** 概览：先讲清楚"这是什么、能做什么"，再让用户进入工段或新建项目。 */
function Overview(props: {
  repo: RepoSummary | null
  tasks: ServerTask[]
  projects: Array<{ id: string; product: string; path: string }>
  stages: ReturnType<typeof mapAllStages>
  source: FactorySource
  aiStatus: AiStatus | null
  onCreate: () => void
  onOpenProjects: () => void
  onContinue: () => void
  onOpenProject: (path: string) => void
  aiConfigured: boolean
  onOpenAi: () => void
}) {
  const task = props.tasks[0]
  const uniqueProjects = props.projects.filter((project, index, list) => list.findIndex((item) => item.product === project.product) === index)
  const done = props.stages.filter((stage) => stage.status === "done").length
  const blocked = props.stages.filter((stage) => stage.status === "blocked" || stage.status === "failed").length
  const active = props.stages.filter((stage) => stage.status === "active").length
  const report = (() => {
    for (let index = props.source.events.length - 1; index >= 0; index -= 1) {
      const event = props.source.events[index]
      if (event && event.type === "delivery.report") return (event.payload as Record<string, unknown>)
    }
    return null
  })()
  const reportStat = (label: string) => {
    const stats = report && Array.isArray(report.stats) ? (report.stats as Array<{ label: string; value: unknown }>) : []
    return stats.find((item) => item.label === label)?.value
  }
  const evidence = Number(reportStat("证据事件")) || props.source.events.length
  const artifacts = Number(reportStat("产物")) || new Set(props.source.events.filter((event) => event.type === "artifact.created").map((event) => String((event.payload as Record<string, unknown>).artifactId ?? ""))).size
  const contract = (() => {
    for (let index = props.source.events.length - 1; index >= 0; index -= 1) {
      const event = props.source.events[index]
      if (event && event.type === "contract.locked") {
        const data = event.payload as Record<string, unknown>
        return { hash: String(data.hash ?? ""), version: Number(data.version ?? 1), lockedAt: String(data.lockedAt ?? "") }
      }
    }
    return null
  })()

  return <section className="home">
    <div className="home-layout">
      <div className="home-main">
        <div className="home-hero">
          <span className="home-eyebrow">PanShi-SwarmFactory · 政企软件工厂</span>
          <h1>把旧系统，改造成可交付的新系统</h1>
          <p className="home-lead">工厂先还原旧系统的业务规则并锁定契约，再让三个角色并发生成代码，最后用护栏、红蓝对抗和交付报告证明它能用。全程留证据，阻断项不会被隐藏。</p>
          <div className="home-actions">
            <button className="button button-primary" type="button" onClick={props.onCreate}><Sparkles size={16} />新建项目</button>
            <button className="button button-secondary" type="button" onClick={props.onContinue}><ArrowRight size={16} />{task ? "继续上次运行" : "进入工段"}</button>
            <button className="button button-quiet" type="button" onClick={props.onOpenProjects}><FolderOpen size={15} />项目</button>
          </div>
          <div className="home-capabilities">
            <span>契约锁定</span>
            <span>证据链</span>
            <span>AI 角色</span>
            <span>红蓝对抗</span>
            <span>可打印交付</span>
          </div>
          {!props.aiConfigured && <div className="home-ai">
            <Bot size={16} />
            <span>还没有接入 AI：工段 02/05/06 目前使用确定性回退。接入后由模型参与改造。</span>
            <button className="button button-secondary" type="button" onClick={props.onOpenAi}>接入 AI</button>
          </div>}
        </div>

        <div className="home-metrics">
          <div className="home-metric"><b>{props.stages.length}</b><span>工段总数</span></div>
          <div className="home-metric is-ok"><b>{done}</b><span>已通过</span></div>
          <div className={"home-metric" + (blocked > 0 ? " is-warn" : "")}><b>{blocked}</b><span>阻断 / 失败</span></div>
          <div className="home-metric"><b>{contract ? "v" + contract.version : "—"}</b><span>契约版本</span></div>
        </div>

        <div className="home-grid">
          <article><span>01 还原</span><b>业务规则与契约</b><p>从旧代码抽出规则，生成 schema / OpenAPI / 组件树并锁定版本。</p></article>
          <article><span>02 生成</span><b>三角色并发代码</b><p>数据库、后端、前端在隔离工作区产出，再合并成可运行代码。</p></article>
          <article><span>03 验收</span><b>护栏与证据</b><p>越权拦截、契约校验、红蓝对抗、交付报告与来源台账。</p></article>
        </div>

        {props.projects.length > 0 && <div className="home-projects">
          <span className="home-projects-title">最近项目</span>
          <div className="home-projects-list">{uniqueProjects.slice(0, 6).map((project) => <button key={project.id} type="button" className="project-chip" onClick={() => props.onOpenProject(project.path)}><b>{project.product}</b><span>{project.id}</span></button>)}</div>
        </div>}

        <p className="home-note">当前工作区：{props.repo?.root ?? "未连接"} · 每个项目是独立的 Git 仓库，位于 runtime-workspace/projects/</p>
      </div>

      <aside className="home-aside">
        <section className="run-card">
          <div className="run-card-head"><span>运行凭证</span><em>{active > 0 ? "RUNNING" : task ? "SNAPSHOT" : "IDLE"}</em></div>
          {contract
            ? <div className="run-seal"><Seal hash={contract.hash} version={contract.version} lockedAt={contract.lockedAt} size={78} /><div className="run-seal-copy"><b>契约已锁定</b><code>{contract.hash.slice(0, 12)}</code><span>{contract.lockedAt ? new Date(contract.lockedAt).toLocaleString("zh-CN") : "时间未知"}</span></div></div>
            : <div className="run-empty">尚未锁定契约：完成工段 05 后生成电子签章。</div>}
          <div className="run-stages">{props.stages.map((stage) => <i key={stage.stage} className={"run-stage is-" + stage.status} title={"工段 " + String(stage.stage).padStart(2, "0") + " " + stage.name} />)}</div>
          <dl className="run-list">
            <div><dt>AI</dt><dd>{props.aiStatus?.configured ? props.aiStatus.model : "未接入"}</dd></div>
            <div><dt>证据</dt><dd>{evidence} 条事件</dd></div>
            <div><dt>产物</dt><dd>{artifacts} 个文件</dd></div>
            <div><dt>工段</dt><dd>{done} / {props.stages.length} 段通过</dd></div>
          </dl>
          {task && <div className="run-task"><span>上次运行</span><b>{task.title}</b><em className={"is-" + (task.factory?.status ?? "not_started")}>{factoryStatusLabel(task.factory) ?? taskStatusLabel(task.status)}</em></div>}
          <button className="button button-primary run-enter" type="button" onClick={props.onContinue}><ArrowRight size={15} />进入工段</button>
        </section>
        <section className="run-note">
          <b>怎么开始</b>
          <p>新建项目 → 接入 AI（可选）→ 从工段 00 逐段运行；每段都会留下事件与产物。</p>
        </section>
      </aside>
    </div>
  </section>
}

function Welcome(props: { repo: RepoSummary | null; projects: Array<{ id: string; product: string; path: string }>; onCreate: () => void; onSample: () => void; onOpenProject: (path: string) => void }) {
  return <section className="welcome">
    <div className="welcome-eyebrow">PanShi-SwarmFactory · 政企软件工厂</div>
    <h1>从一句需求，到可交付的软件</h1>
    <p className="welcome-lead">定义产品与数据实体，工厂会生成契约、可点击原型、数据库/后端/前端代码，并跑完护栏、红蓝对抗与交付报告。所有结果都带证据，阻断项不会被隐藏。</p>
    <div className="welcome-steps">
      <article><span>01</span><b>定义项目</b><p>产品名、数据实体、页面锚点；可直接用模板改。</p></article>
      <article><span>02</span><b>生成契约与原型</b><p>schema / OpenAPI / component_tree 锁定，原型可点击核对。</p></article>
      <article><span>03</span><b>十工段生成与质检</b><p>三角色并发产出代码，护栏与红蓝对抗给出证据。</p></article>
    </div>
    <div className="welcome-actions">
      <button className="button button-primary" type="button" onClick={props.onCreate}><Sparkles size={16} />新建项目</button>
      <button className="button button-secondary" type="button" onClick={props.onSample}><ArrowRight size={16} />体验当前工作区</button>
    </div>
    {props.projects.length > 0 && <div className="welcome-projects">
      <span className="welcome-projects-title">最近项目</span>
      <div className="welcome-projects-list">{props.projects.slice(0, 6).map((project) => <button key={project.id} type="button" className="project-chip" onClick={() => props.onOpenProject(project.path)}><b>{project.product}</b><span>{project.id}</span></button>)}</div>
    </div>}
    <p className="welcome-note">当前工作区：{props.repo?.root ?? "未连接"} · 点击左侧工段可查看每个工段的产出说明</p>
  </section>
}

function Onboard(props: { onOpenHelp: () => void; onOpenWizard: () => void }) {
  const [hidden, setHidden] = useState(() => localStorage.getItem("rp-onboard") === "1")
  if (hidden) return null
  return <div className="onboard">
    <span className="onboard-icon">{I({ name: "Compass", size: 15 })}</span>
    <p><b>第一次使用？</b>① 新建运行交代目标 → ② 审批计划 → ③ 沿工段查看证据。未批准不会执行命令或写入文件。</p>
    <button className="button button-primary" type="button" onClick={props.onOpenWizard}><Sparkles size={14} />开发新项目</button>
    <button className="button button-quiet" type="button" onClick={props.onOpenHelp}>查看引导</button>
    <button className="icon-button" type="button" aria-label="不再提示" onClick={() => { setHidden(true); localStorage.setItem("rp-onboard", "1") }}><X size={14} /></button>
  </div>
}

function Baseline(props: { source: FactorySource }) {
  const repo = props.source.repo
  return <section className="io-col"><div className="io-head">接入基线事实<span className="io-head-meta">来自运行时仓库扫描</span></div><div className="io-list">
    <div className="io-item"><span className="io-name">仓库</span><span className="io-hash">{repo?.root ?? "未连接"}</span><span className="io-state">{repo?.baseRevision ? "ready" : "blocked"}</span></div>
    <div className="io-item"><span className="io-name">基线 revision</span><span className="io-hash">{repo?.baseRevision ? repo.baseRevision.slice(0, 16) : "未读取"}</span><span className="io-state">{repo?.baseRevision ? "locked" : "pending"}</span></div>
    <div className="io-item"><span className="io-name">主要语言</span><span className="io-hash">{repo?.languages.join(" / ") || "未识别"}</span><span className="io-state">observed</span></div>
    <div className="io-item"><span className="io-name">包管理器</span><span className="io-hash">{repo?.packageManager ?? "未探测"}</span><span className="io-state">{repo ? "observed" : "empty"}</span></div>
    <div className="io-item"><span className="io-name">入口文件</span><span className="io-hash">{repo?.entrypoints.join(", ") || "未识别"}</span><span className="io-state">observed</span></div>
    <div className="io-item"><span className="io-name">工作区状态</span><span className="io-hash">{repo ? (repo.hasUncommittedChanges ? "存在未提交变更" : "工作区干净") : "未读取"}</span><span className="io-state">{repo?.hasUncommittedChanges ? "warn" : "clean"}</span></div>
    {(() => {
      // s0.ts 已发 baseline.secretScan（scannedFiles / findings / masked）。
      // 之前这里写死成「后端数据尚未接入」，把已经实现的能力显示成缺失。
      const scan = [...props.source.events].reverse().find((event) => event.type === "baseline.secretScan")
      if (!scan) return <div className="io-item"><span className="io-name">敏感信息扫描</span><span className="io-hash">尚未执行</span><span className="io-state">pending</span></div>
      const data = scan.payload as Record<string, unknown>
      const findings = Number(data.findings ?? 0)
      return <div className="io-item"><span className="io-name">敏感信息扫描</span><span className="io-hash">{`扫描 ${String(data.scannedFiles ?? "?")} 个文件 · 命中 ${findings} 处`}</span><span className="io-state">{findings > 0 ? "masked" : "clean"}</span></div>
    })()}
  </div></section>
}

/** 最近运行：直接来自运行时任务列表，不额外编造。 */
function RecentRuns(props: { tasks: ServerTask[]; onCreate: () => void }) {
  const rows = props.tasks.slice(0, 5)
  return <section className="io-col recent-runs">
    <div className="io-head">最近运行<span className="io-head-meta">{props.tasks.length} 条任务</span></div>
    <div className="io-list">
      {rows.length === 0
        ? <Empty title="还没有运行记录" detail="创建工厂运行后，这里按更新时间倒序展示真实任务。" />
        : rows.map((item) => {
          const factory = item.factory
          const label = factory
            ? factory.status === "succeeded" ? "工厂已完成"
              : factory.status === "failed" ? "工厂失败"
                : factory.status === "blocked" ? "工厂阻断 " + String(factory.blocked)
                  : factory.status === "running" ? "工厂 " + String(factory.done) + "/" + String(factory.total)
                    : "工厂未运行"
            : taskStatusLabel(item.status)
          const stateClass = factory ? "factory-" + factory.status : item.status
          return <div className="io-item run-item" key={item.id}>
            <span className="io-name">{item.title || item.id}</span>
            <span className="io-hash">{item.id} · {item.mode}</span>
            <span className={"io-state run-state-" + stateClass}>{label}</span>
          </div>
        })}
    </div>
  </section>
}
function taskStatusLabel(status: ServerTask["status"]): string {
  if (status === "succeeded") return "已完成"
  if (status === "failed") return "失败"
  if (status === "cancelled") return "已取消"
  if (status === "acting") return "执行中"
  if (status === "verifying") return "验证中"
  if (status === "awaiting_approval") return "待审批"
  if (status === "planning") return "规划中"
  if (status === "blocked") return "已阻塞"
  return "排队中"
}
function blockedReason(events: AgentEvent[], stage: number): string {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event || event.type !== "stage.failed") continue
    const data = event.payload as Record<string, unknown>
    if (Number(data.stageId) !== stage) continue
    const message = String(data.message ?? "")
    if (message) return message.length > 46 ? `${message.slice(0, 46)}…` : message
  }
  return "未通过出口校验"
}

function collectHighlights(events: AgentEvent[]): Array<{ tone: "ok" | "warn" | "info"; text: string }> {
  const highlights: Array<{ tone: "ok" | "warn" | "info"; text: string }> = []
  let contract = ""
  let harness = ""
  const attacks = new Map<string, boolean>()
  let rails = 0
  let stage8Start = -1
  let stage7Start = -1
  for (const event of events) {
    const stage = Number((event.payload as Record<string, unknown>).stageId)
    if (event.type === "stage.started" && stage === 8) stage8Start = event.seq
    if (event.type === "stage.started" && stage === 7) stage7Start = event.seq
  }
  for (const event of events) {
    const data = event.payload as Record<string, unknown>
    if (event.type === "contract.locked") contract = `契约 v${String(data.version ?? 1)} · ${String(data.hash ?? "").slice(0, 8)} 已锁定`
    if (event.type === "skill.harness") harness = `MCP Harness ${String(data.passed ?? 0)}/${String(data.cases ?? 0)} 通过`
    if (event.type === "attack.finding" && event.seq >= stage8Start) attacks.set(String(data.id ?? event.seq), String(data.status ?? "open") === "open")
    // 只统计最近一轮、且 severity=block 的拦截。
    // 累计全部历史会把重跑算进去；把 AuditRail 的「检查完成」留痕算进去更会把审计读成拦截。
    if (event.type === "rail.violation" && event.seq >= stage7Start && data.severity !== "warn") rails += 1
  }
  const openAttacks = [...attacks.values()].filter(Boolean).length
  if (contract) highlights.push({ tone: "ok", text: contract })
  if (harness) highlights.push({ tone: "ok", text: harness })
  if (rails > 0) highlights.push({ tone: "warn", text: `护栏拦截 ${rails} 条` })
  const resolvedAttacks = [...attacks.values()].filter((value) => value === false).length
  if (resolvedAttacks > 0) highlights.push({ tone: "ok", text: `红蓝对抗 ${resolvedAttacks} 条已复现并修复` })
  else if (openAttacks > 0) highlights.push({ tone: "warn", text: `红蓝对抗 ${openAttacks} 条发现` })
  return highlights.slice(0, 4)
}

/** 运行摘要：把"9/10 是什么"、亮点与下一步集中到首屏。 */
function RunHero(props: {
  task: ServerTask | null
  done: number
  blocked: Array<{ stage: number; name: string; reason: string }>
  artifacts: number
  events: number
  progress: number
  segments: StageStatus[]
  highlights: Array<{ tone: "ok" | "warn" | "info"; text: string }>
  onOpenDelivery: () => void
  onRun: () => void
  running: boolean
}) {
  const blocked = props.blocked
  const naCount = props.segments.filter((status) => status === "not_applicable").length
  return <section className={"run-hero" + (blocked.length > 0 ? " is-blocked" : props.task ? " is-ok" : "")} aria-label="本次运行摘要">
    <span className="run-hero-icon">{I({ name: "Blocks", size: 20 })}</span>
    <div className="run-hero-main">
      <div className="run-hero-eyebrow"><span className="dot" />本次运行 · {props.task?.runId?.slice(0, 16) ?? "未运行"} · 证据 {props.events} 条 · 产物 {props.artifacts} 份</div>
      <div className="run-hero-title">{props.task?.title || "尚未命名的工厂运行"}</div>
      {props.task
        ? <p className="run-hero-status"><b>{props.done} / {props.segments.filter((status) => status !== "not_applicable").length}</b> 工段通过{blocked.length > 0 ? ` · ${blocked.length} 个阻断` : " · 全链路通过"}{naCount > 0 ? ` · ${naCount} 项不适用` : ""}{props.done === 0 ? " · 尚未开始" : ""}</p>
        : <p className="run-hero-status">尚未创建工厂运行：点右侧按钮开始，系统会按十工段依次执行并留下证据。</p>}
      {blocked.map((item) => <p className="run-hero-blocked" key={item.stage}><b>工段 {String(item.stage).padStart(2, "0")} {item.name}</b>{item.reason}</p>)}
      <div className="run-hero-highlights">{props.highlights.map((item) => <span key={item.text} className={"highlight-chip is-" + item.tone}>{I({ name: item.tone === "ok" ? "Check" : item.tone === "warn" ? "TriangleAlert" : "Zap", size: 12 })}{item.text}</span>)}</div>
    </div>
    <div className="run-hero-side">
      <div className="hero-progress">
        <span className="hero-progress-value">{props.progress}%<small>可验证进度</small></span>
        <div className="hero-segments">{props.segments.map((status, index) => <span key={index} className={"hero-seg is-" + status} title={`工段 ${String(index).padStart(2, "0")}：${status === "done" ? "通过" : status === "blocked" ? "阻断" : status === "failed" ? "失败" : status === "active" ? "执行中" : status === "not_applicable" ? "不适用" : "待运行"}`} />)}</div>
        <span className="hero-progress-note">共 {props.segments.length} 段 · 通过 {props.done} · 阻断 {props.blocked.length}{naCount > 0 ? ` · 不适用 ${naCount}` : ""} · 待运行 {props.segments.filter((status) => status === "pending").length}</span>
      </div>
      {props.task
        ? <button className="button button-primary" type="button" onClick={props.onOpenDelivery}>{I({ name: "PackageCheck", size: 15 })}查看交付报告</button>
        : <button className="button button-primary" type="button" onClick={props.onRun} disabled={props.running}>{props.running ? <LoaderCircle className="spin" size={15} /> : <Rocket size={15} />}运行 MVP 全链路</button>}
    </div>
  </section>
}
function WorkflowRibbon(props: { stages: Array<{ stage: StageId; name: string; status: StageStatus; selected: boolean }>; onSelect: (id: StageId) => void }) {
  const labels: Record<StageStatus, string> = { done: "通过", active: "执行中", failed: "失败", blocked: "阻断", pending: "待运行", not_applicable: "不适用" }
  return <section className="workflow" aria-label="十工段工作流">
    <div className="workflow-head"><b>十工段工作流</b><span>点击任意节点跳转 · 灰色为待运行</span></div>
    <ol className="workflow-track">{props.stages.map((item) => <li key={item.stage} className={"workflow-node is-" + item.status + (item.selected ? " is-current" : "")}>
      <button type="button" onClick={() => props.onSelect(item.stage)} aria-label={`工段 ${item.stage} ${item.name}：${labels[item.status]}`}>
        <span className="workflow-dot">{item.status === "done" ? <Check size={15} /> : item.status === "blocked" || item.status === "failed" ? <TriangleAlert size={14} /> : item.status === "not_applicable" ? <Minus size={14} /> : String(item.stage).padStart(2, "0")}</span>
        <span className="workflow-name">{item.name}</span>
        <span className="workflow-state">{labels[item.status]}</span>
      </button>
    </li>)}</ol>
    <div className="workflow-legend">
      <span><i className="is-done" />通过</span>
      <span><i className="is-blocked" />阻断</span>
      <span><i className="is-pending" />待运行</span>
      <span className="legend-note">共 10 段 · 点击节点查看该工段</span>
    </div>
  </section>
}
type StageFact = { label: string; value: string; tone?: "ok" | "warn" | "danger" }
type StageRule = { path: string; line: number; summary: string; kind: string }

/** 从事件日志还原工段 1-4 的真实事实，不再用"待接入"占位。 */
function buildStageFacts(stage: number, events: AgentEvent[]): { facts: StageFact[]; rules: StageRule[] } {
  const facts: StageFact[] = []
  const rules: StageRule[] = []
  const last = (type: string): Record<string, unknown> | null => {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (!event || event.type !== type) continue
      const data = event.payload as Record<string, unknown>
      const eventStage = Number(data.stageId)
      if (Number.isInteger(eventStage) && eventStage !== stage) continue
      return data
    }
    return null
  }

  if (stage === 1) {
    const diagnosis = last("greenbuild.diagnosis")
    if (diagnosis) {
      facts.push({ label: "构建命令", value: String(diagnosis.command ?? "unknown") })
      facts.push({ label: "退出码", value: String(diagnosis.exitCode ?? "?"), tone: Number(diagnosis.exitCode) === 0 ? "ok" : "warn" })
      facts.push({ label: "失败分类", value: String(diagnosis.classification ?? "unknown") })
    }
    const verdict = last("greenbuild.verdict")
    if (verdict) facts.push({ label: "可继续修复", value: verdict.runnable === true ? "是（测试类失败）" : "否", tone: verdict.runnable === true ? "ok" : "danger" })
    const outputLines = String(diagnosis?.outputTail ?? diagnosis?.stderrTail ?? "").split("\n").map((line) => line.trim()).filter(Boolean)
    const keyLine = outputLines.find((line) => /AssertionError|expected:|actual:|not ok|✖|Error:/.test(line))
    const tail = (keyLine ?? outputLines.slice(-1)[0] ?? "").slice(0, 160)
    if (tail) facts.push({ label: "错误摘要", value: tail })
  }

  if (stage === 3) {
    const symbols = last("decompile.symbols")
    const diff = last("decompile.diff")
    const equivalence = last("decompile.equivalence")
    const skipped = last("stage.skipped")
    if (skipped) {
      facts.push({ label: "工段状态", value: "不适用（本仓库没有黑盒目标）", tone: "warn" })
      facts.push({ label: "如何启用", value: "在仓库根添加 blackbox.json 声明黑盒与重写实现" })
    }
    if (symbols) {
      const reports = Array.isArray(symbols.reports) ? (symbols.reports as Array<Record<string, unknown>>) : []
      const wasm = reports.filter((item) => item.kind === "wasm")
      const native = reports.filter((item) => item.kind === "native")
      facts.push({ label: "黑盒目标", value: `${reports.length} 个（wasm ${wasm.length} · 原生 ${native.length}）` })
      for (const item of wasm) {
        const exported = Array.isArray(item.exports) ? (item.exports as Array<Record<string, unknown>>) : []
        const fileName = String(item.binary ?? "wasm").split("/").pop() ?? "wasm"
        facts.push({
          label: "黑盒文件",
          value: `${fileName} · ${String(item.bytes ?? 0)} 字节 · 导出 ${exported.filter((entry) => entry.kind === "function").map((entry) => String(entry.name)).join(", ") || "无"}`,
        })
      }
    }
    if (diff) {
      const cases = Number(diff.cases ?? 0)
      const mismatches = Number(diff.mismatches ?? 0)
      facts.push({ label: "差分对拍", value: `${cases} 组输入`, tone: "ok" })
      facts.push({
        label: "不一致",
        value: mismatches === 0 ? "0 组（逐值一致）" : `${mismatches} 组`,
        tone: mismatches === 0 ? "ok" : "danger",
      })
    }
    if (equivalence) {
      facts.push({
        label: "等价结论",
        value: String(equivalence.statement ?? ""),
        tone: equivalence.verified === true ? "ok" : "danger",
      })
    }
  }

  if (stage === 2) {
    const slice = last("archaeology.slice")
    const rule = last("archaeology.rule")
    const unanalyzed = last("archaeology.unanalyzed")
    const slices = Array.isArray(slice?.slices) ? (slice.slices as unknown[]) : []
    const ruleList = Array.isArray(rule?.rules) ? (rule.rules as Array<Record<string, unknown>>) : []
    const areas = Array.isArray(unanalyzed?.areas) ? (unanalyzed.areas as unknown[]) : []
    facts.push({ label: "代码切片", value: String(slices.length), tone: slices.length > 0 ? "ok" : "warn" })
    facts.push({ label: "业务规则", value: String(ruleList.length), tone: ruleList.length > 0 ? "ok" : "warn" })
    facts.push({ label: "SQL 规则", value: String(ruleList.filter((item) => String(item.kind) === "sql").length) })
    const ruleMode = String(rule?.mode ?? "")
    if (ruleMode) facts.push({ label: "规则来源", value: ruleMode === "ai" ? "模型提取（AI " + String(rule?.aiRules ?? 0) + " 条）" : ruleMode === "fallback" ? "AI 调用失败，已回退" : "确定性 AST" })
    facts.push({ label: "未分析项", value: String(areas.length), tone: areas.length === 0 ? "ok" : "warn" })
    for (const item of ruleList.slice(0, 6)) {
      rules.push({ path: String(item.path ?? ""), line: Number(item.line ?? 0), summary: String(item.summary ?? ""), kind: String(item.kind ?? "") })
    }
  }

  if (stage === 4) {
    const build = last("skill.build")
    if (build) {
      facts.push({ label: "技能标识", value: String(build.skillId ?? build.name ?? "") })
      facts.push({ label: "工具", value: String(build.tool ?? "") })
    }
    const harness = last("skill.harness")
    if (harness) facts.push({ label: "验毒用例", value: `${String(harness.passed ?? 0)} / ${String(harness.cases ?? 0)} 通过`, tone: Number(harness.failed) === 0 ? "ok" : "warn" })
    const license = last("skill.license")
    if (license) facts.push({ label: "许可证", value: String(license.license ?? "未知") })
    const register = last("skill.register")
    if (register) facts.push({ label: "注册", value: String(register.registryEntry ?? "") })
  }

  return { facts, rules }
}

function StagePlan(props: { stage: StageId; onOpenArtifacts: () => void; facts: StageFact[]; rules: StageRule[]; outputs: StageView["outputs"]; exitCriteria: string; onNext: () => void }) {
  const contractArtifacts = STAGE_ARTIFACTS[props.stage] ?? []
  const hasFacts = props.facts.length > 0
  return <div className="stage-chapter">
    <section className="chapter-main">
      <div className="panel-head">本工段结论<span className="panel-head-meta">来自事件与产物</span></div>
      {props.facts.some((fact) => fact.label === "状态" && String(fact.value).includes("阻断")) && <div className="chapter-blocked">
        <span className="chapter-blocked-icon"><TriangleAlert size={18} /></span>
        <div>
          <b>本工段被阻断{props.facts.find((fact) => fact.label === "错误码") ? " · " + props.facts.find((fact) => fact.label === "错误码")!.value : ""}</b>
          <p>{props.facts.find((fact) => fact.label === "原因")?.value ?? "缺少继续执行的前置条件。"}</p>
          <small>阻断不会被隐藏；补齐条件后重新运行本段即可继续。</small>
        </div>
      </div>}
      {hasFacts
        ? <dl className="chapter-facts">{props.facts.slice(0, 5).map((fact) => <div className="chapter-fact" key={fact.label}><dt>{fact.label}</dt><dd className={fact.tone ? "is-" + fact.tone : undefined}>{fact.value}</dd></div>)}</dl>
        : <p className="chapter-empty">该工段尚未执行：产物契约已定义，未执行不会显示为通过。</p>}
      {props.rules.length > 0 && <ul className="chapter-rules">{props.rules.slice(0, 3).map((rule) => <li key={rule.path + rule.line}><code>{rule.path}:{rule.line}</code><span>{rule.summary}</span></li>)}</ul>}
      <div className="chapter-next">
        <div><b>下一步</b><p>{STAGE_GUIDE[props.stage]}</p></div>
        <button className="button button-secondary" type="button" onClick={props.onNext}>进入下一工段<ArrowRight size={14} /></button>
      </div>
      <p className="chapter-exit"><b>退出条件</b>{props.exitCriteria}</p>
      <button className="button button-secondary chapter-more" type="button" onClick={props.onOpenArtifacts}>查看全部事实与规则</button>
    </section>
    <aside className="chapter-side">
      <div className="panel-head">产物<span className="panel-head-meta">{props.outputs.length}</span></div>
      {props.outputs.length > 0
        ? <ul className="chapter-artifacts">{props.outputs.map((artifact) => <li key={artifact.artifactId}><b>{artifactLabel(artifact.name)}</b><small>{artifact.name}</small></li>)}</ul>
        : <ul className="chapter-artifacts is-contract">{contractArtifacts.map((name) => <li key={name}><b>{artifactLabel(name)}</b><small>契约要求 · 待产出</small></li>)}</ul>}
      <button className="button button-quiet" type="button" onClick={props.onOpenArtifacts}>打开产物</button>
    </aside>
  </div>
}
/** 锚点标识只在分隔符后允许换行，避免 procurement.invoice_verify 被从单词中间劈开。 */
function AnchorText({ value }: { value: string }) {
  const parts = value.split(/(?<=[._/-])/)
  return <>{parts.map((part, index) => <span key={index}>{part}{index < parts.length - 1 ? <wbr /> : null}</span>)}</>
}
function Head(props: { name: string; title: string; anchor: string }) { return <div className="role-head"><span className="role-avatar">{I({ name: props.name, size: 16 })}</span><span className="role-name">{props.title}</span><span className="anchor-flag"><AnchorText value={props.anchor} /></span></div> }
function Biz(props: { anchor: PanshiAnchorId; setAnchor: (id: PanshiAnchorId) => void; invoiceBlocked: boolean; onInvoice: () => void; submitConfirm: boolean; onSubmit: () => void; approvals: ApprovalRecord[]; prototypeReady: boolean; contractHash: string }) {
  return <section className="biz-shell" data-anchors="dev"><div className="biz-topbar"><span className="brand-mark">{I({ name: "Boxes", size: 15 })}</span><strong>物资采购与固定资产管理系统</strong><span className="stage-sub">原型 / 契约锚点核对</span></div><div className="biz-contract-bar">
    <span className={"state-chip" + (props.contractHash ? " is-ok" : "")}>{I({ name: "FileSignature", size: 13 })}契约 {props.contractHash ? "v1 · " + props.contractHash.slice(0, 8) + " 已锁定" : "未锁定"}</span>
    <span className={"state-chip" + (props.prototypeReady ? " is-ok" : "")}>{I({ name: "MonitorSmartphone", size: 13 })}原型 {props.prototypeReady ? "已生成 · 7 个锚点" : "未生成"}</span>
    <span className="state-chip">{I({ name: "Check", size: 13 })}人工审批 {props.approvals.length} 条</span>
    <span className="state-chip">字段待前端渲染</span>
  </div><div className="biz-body"><nav className="biz-nav" aria-label="业务原型导航">{ANCHOR_ORDER.map((item) => <button className={"nav-item" + (props.anchor === item.id ? " is-active" : "")} type="button" key={item.id} onClick={() => props.setAnchor(item.id)}>{I({ name: item.icon, size: 15 })}<span>{item.label}</span></button>)}</nav><div className="biz-page"><div className="biz-page-head"><h3>采购审批原型</h3><span className="anchor-flag">7 个固定锚点</span><span className="spacer" /><span className="stage-sub">契约已生成 · 字段待前端渲染</span></div><div className="role-grid">
    <section className="role-card" data-panshi-id="procurement.table"><Head name="Table" title="采购单列表" anchor="procurement.table" /><table className="procurement-table"><thead><tr><th>契约字段</th><th>金额</th><th>状态</th></tr></thead><tbody><tr><td colSpan={3}><Empty title="采购数据尚未接入" detail="schema.sql / OpenAPI 到位后显示真实行。" /></td></tr></tbody></table></section>
    <section className="role-card" data-panshi-id="procurement.create"><Head name="FilePlus2" title="新建采购单" anchor="procurement.create" /><form className="procurement-form" onSubmit={(event) => event.preventDefault()}><label className="field"><span className="field-label">物资名称（OpenAPI 字段）</span><input className="field-input" placeholder="等待契约字段" disabled /></label><label className="field"><span className="field-label">金额（OpenAPI 字段）</span><input className="field-input" placeholder="等待契约字段" disabled /></label></form></section>
    <section className="role-card" data-panshi-id="procurement.invoice_verify"><Head name="ReceiptText" title="发票核验" anchor="procurement.invoice_verify" /><div className="invoice-verify"><button className="button button-secondary verify-button" type="button" onClick={props.onInvoice}>{I({ name: "ReceiptText", size: 15 })}调用转换后的 Skill</button><span className="verify-result">{props.invoiceBlocked ? "blocked：MCP Skill 后端尚未接入，未执行" : "等待真实 Skill 结果"}</span></div></section>
    <section className="role-card" data-panshi-id="procurement.submit"><Head name="Send" title="提交审批" anchor="procurement.submit" /><div className="procurement-submit"><button className="button button-primary" type="button" onClick={props.onSubmit}>{props.submitConfirm ? "再次确认提交（RBAC 未接入）" : "提交审批（RBAC 写操作）"}</button></div>{props.submitConfirm && <div className="state-blocked" role="status"><div className="blocked-head"><TriangleAlert size={17} />写操作未执行</div><p className="blocked-reason">后端 RBAC 和审批服务尚未接入，当前只保留两步确认交互。</p></div>}</section>
    <section className="role-card" data-panshi-id="approval.timeline"><Head name="GitCommitHorizontal" title="审批时间线" anchor="approval.timeline" /><ol className="approval-timeline"><li className="tl-item"><span className="tl-dot"><CircleDashed size={14} /></span><span className="tl-copy"><span className="tl-role">等待真实审批事件</span><span className="tl-time">后端数据尚未接入</span></span></li></ol></section>
    <section className="role-card" data-panshi-id="inventory.summary"><Head name="Boxes" title="库存汇总" anchor="inventory.summary" /><div className="inventory-summary"><div className="inv-metric"><div className="metric-value">—</div><div className="metric-label">库存数据尚未接入</div></div></div></section>
    <section className="role-card" data-panshi-id="budget.dashboard"><Head name="Gauge" title="预算看板" anchor="budget.dashboard" /><div className="budget-dashboard"><div className="budget-card"><div className="budget-row"><span>预算数据尚未接入</span><span className="budget-num">—</span></div><div className="budget-bar"><div className="bar-fill" style={{ width: "0%" }} /></div></div></div></section>
  </div></div></div></section>
}
/** 需求包驱动的契约原型：锚点、路由与 RBAC 都来自 component_tree / requirement。 */
function CustomPrototype(props: { prototype: PrototypeView }) {
  return <section className="custom-prototype">
    <div className="cp-head">
      <div>
        <h2>{props.prototype.product ?? "契约原型"}</h2>
        <p>由需求包生成 · {props.prototype.anchors.length} 个锚点 · 字段与列名来自 schema / OpenAPI</p>
      </div>
      <span className="state-chip is-ok">{I({ name: "LockKeyhole", size: 13 })}契约已锁定</span>
    </div>
    <div className="cp-grid">
      {props.prototype.anchors.map((anchor, index) => <article className="cp-card" key={anchor.id} data-panshi-id={anchor.id}>
        <span className="cp-index">{String(index + 1).padStart(2, "0")}</span>
        <h3>{anchor.label}</h3>
        <code>{anchor.id}</code>
        <dl>
          <div><dt>路由</dt><dd>{anchor.route}</dd></div>
          <div><dt>方法</dt><dd>{(anchor.method ?? "get").toUpperCase()}</dd></div>
          <div><dt>RBAC</dt><dd>{anchor.scope ?? "public"}</dd></div>
        </dl>
      </article>)}
    </div>
    {props.prototype.entities.length > 0 && <div className="cp-entities">
      <span className="cp-entities-title">数据模型</span>
      <ul>{props.prototype.entities.map((entity) => <li key={entity.table}><code>{entity.table}</code><span>{entity.fields.map((field) => field.name + ":" + field.type).join(" · ")}</span></li>)}</ul>
    </div>}
    <p className="cp-foot">静态原型只确认信息架构与锚点；表单字段、表格列与页面代码由阶段 06 生成。</p>
  </section>
}

function Roles(props: { roles: RoleView[] }) {
  const done = props.roles.filter((item) => item.status === "done").length
  const running = props.roles.filter((item) => item.status === "running").length
  const hasData = done + running > 0
  return <>
    <div className="role-summary">
      <span className="role-summary-main">{I({ name: "Users", size: 16 })}{hasData ? `${done} 个角色已完成` : "12 个角色合同已定义"}</span>
      <span className="role-summary-sub">{hasData ? "Database / Backend / Frontend 三个角色并发产出并合并；预算按生成字节计。" : "后端角色数据尚未接入：并发执行、预算与产物均未产生，未执行不显示为通过。"}</span>
      <span className="role-summary-flag">{hasData ? `真实产物 ${done} 份` : "真实并发证据：尚未接入"}</span>
    </div>
    {/* 角色没有任何运行数据时后端给的是 blocked；直接显示"阻断"会让整页读起来像全挂了。
        这里只改呈现：没有运行数据（预算未产生）的角色显示"待运行"，语义仍是未执行。 */}
    <div className="role-grid">{props.roles.map((role) => {
      const pending = role.status === "blocked" && role.budget.limit === 0
      const label = pending ? "待运行" : role.status === "blocked" ? "阻断" : role.status === "running" ? "执行中" : role.status === "failed" ? "失败" : role.status === "done" ? "已完成" : "排队中"
      const tone = role.role === "Chief Architect" || role.role === "Contract Builder" ? "architect" : role.role === "Judge" ? "judge" : role.role === "Red Agent" ? "red" : role.role === "Blue Agent" ? "blue" : "builder"
      return <article className={"role-card role-" + (pending ? "pending" : role.status) + " role-tone-" + tone} key={role.role}><div className="role-head"><span className="role-avatar"><RoleGlyph role={role.role} /></span><span className="role-title"><span className="role-name">{roleLabel(role.role)}</span><span className="role-name-en">{role.role}</span></span><span className="role-status">{label}</span></div><div className="role-facts"><span className="role-stage">工段 {String(role.stage).padStart(2, "0")}</span><span className="role-budget-text">{role.budget.limit > 0 ? `${role.budget.used} / ${role.budget.limit} 预算` : pending ? "该工段尚未运行" : "未接入"}</span></div></article>
    })}</div>
  </>
}
function Rails(props: { violations: RailViolation[]; stats: RailStatsView | null }) {
  const fields = ["railName", "role", "tool", "file", "line", "reason", "expected", "actual", "contractHash", "recoveryHint"]
  // rail.violation 里混着两类事件：severity=block 才是真的拦截，
  // severity=warn 是 AuditRail 的「本轮检查完成」审计留痕。
  // 混在一起计数会让「阻断 1 条」和侧栏「2 条」对不上，也会把留痕读成拦截。
  const blocks = props.violations.filter((item) => item.severity === "block")
  const audits = props.violations.filter((item) => item.severity === "warn")
  return <section className="rail-view">
    <div className="rail-main">
      <div className="rail-summary"><span className="rail-summary-title">{I({ name: "ShieldCheck", size: 16 })}确定性护栏链</span><span className="rail-summary-meta">{props.stats ? props.stats.rails + " 道关卡 · 检查 " + props.stats.checks + " 项 · 阻断 " + props.stats.violations + " 条" : `${RAIL_ORDER.length} 道关卡 · 本轮阻断 ${blocks.length} 条`}</span></div>
      <ol className="rail-chain">{RAIL_ORDER.map((rail, index) => {
        const hit = blocks.filter((item) => item.railName === rail.name).length
        // AuditRail 的留痕不算拦截：它记录的是「本轮检查完成」，不是被挡下的写入。
        const audit = rail.name === "AuditRail" && audits.length > 0
        return <li className="rail-row" key={rail.name}><span className="rail-index">{String(index + 1).padStart(2, "0")}</span><span className="rail-name"><b>{railLabel(rail.name)}</b><small>{rail.name}</small></span><span className="rail-desc">{rail.desc}</span><span className={"rail-state" + (hit > 0 ? " is-hit" : "")}>{hit > 0 ? `阻断 ${hit}` : audit ? "已留痕" : "未触发"}</span></li>
      })}</ol>
    </div>
    <aside className="rail-side">
      <div className="panel-head">{I({ name: "Archive", size: 16 })}阻断与审计<span className="panel-head-meta">{blocks.length} 条阻断{audits.length > 0 ? ` · ${audits.length} 条留痕` : ""}</span></div>
      <div className="rail-side-body">
        {props.violations.length === 0
          ? <Empty title="暂无阻断记录" detail="规则已定义，事件尚未接入；未执行、阻断和失败不会显示成通过。" />
          : <div className="rail-list">{props.violations.map((item, index) => <article className={"rail-violation" + (item.severity === "warn" ? " is-audit" : "")} key={item.railName + item.role + index}><div className="rv-head"><span className="rv-name">{I({ name: "ShieldCheck", size: 15 })}<b>{railLabel(item.railName)}</b><small>{item.railName}</small></span><span className="rv-sev">{item.severity === "warn" ? "审计留痕" : "已阻断"}</span></div><dl className="rv-body"><dt>角色</dt><dd>{roleLabel(item.role)}<small>{item.role}</small></dd><dt>原因</dt><dd>{item.reason}</dd><dt>期望</dt><dd>{item.expected}</dd><dt>实际</dt><dd>{item.actual}</dd><dt>契约哈希</dt><dd>{item.contractHash}</dd></dl><div className="rv-recovery">{item.recoveryHint}</div></article>)}</div>}
        <div className="rail-fields"><h4>每条阻断将带上</h4><div className="rail-field-list">{fields.map((field) => <code key={field}>{field}</code>)}</div></div>
      </div>
    </aside>
  </section>
}
function Adversarial(props: { board: AdversarialBoard; permission: PermissionView | null }) {
  const empty = <Empty title="尚未接入" detail="没有真实攻防事件时不生成假数据。" />
  const repaired = props.board.attacks.some((item) => item.resolved)
  return <section className="adversarial-board">
    <article className="attack-panel">
      <div className="panel-head">{I({ name: "Sword", size: 16 })}红军 · 攻击<span className="panel-head-meta">{props.board.attacks.length} 条发现</span></div>
      <div className="panel-body">{props.board.attacks.length ? props.board.attacks.map((item) => <div className={"finding-card" + (item.resolved ? " is-resolved" : "")} key={item.id}><span className={"fc-sev sev-" + item.severity}>{item.severity}</span><div className="fc-title">{item.title}</div></div>) : empty}</div>
    </article>
    <article className="judge-panel">
      <div className="panel-head">{I({ name: "Scale", size: 16 })}裁判 · 不变量<span className="panel-head-meta">{props.board.judgeInvariants.length} 项</span></div>
      <div className="panel-body">{props.board.judgeInvariants.length ? <ul className="invariant-list">{props.board.judgeInvariants.map((text) => <li key={text}>{text}</li>)}</ul> : empty}
        {props.permission && <div className="permission-block">
          <div className="permission-head">权限检查（{props.permission.mode === "static" ? "静态" : "运行时"}）· {props.permission.passed}/{props.permission.checks.length} 通过</div>
          <ul className="permission-list">{props.permission.checks.slice(0, 5).map((check) => <li key={check.method + check.path} className={check.passed ? "is-pass" : "is-fail"}><span>{check.passed ? "✓" : "✕"}</span><code>{check.method} {check.path}</code><em>{check.requiredScope ?? "public"}</em></li>)}</ul>
        </div>}
      </div>
    </article>
    <article className="repair-panel">
      <div className="panel-head">{I({ name: "ShieldPlus", size: 16 })}蓝军 · 修复</div>
      <div className="panel-body">{repaired ? <div className="repair-done"><strong>已修复并通过复测</strong><p>修复 diff 与二次对拍结果已写入产物。</p></div> : empty}</div>
    </article>
  </section>
}
function Cruise(props: { cruise: CruiseView }) {
  const path = ["登录", "打开采购申请", "新建采购单", "调用发票 Skill", "提交审批", "查看库存与预算"]
  return <>
    <section className="cruise-view">
      <div className="cruise-steps"><div className="panel-head">{I({ name: "MonitorSmartphone", size: 16 })}巡航步骤<span className="panel-head-meta">{props.cruise.steps.length ? `${props.cruise.steps.length} 步` : "Playwright 待接入"}</span></div>{props.cruise.steps.length ? <ul className="cruise-step-list">{props.cruise.steps.map((step) => <li key={step.id} className={"cruise-step is-" + step.status}><span className="step-dot" />{step.label}</li>)}</ul> : <Empty title="浏览器巡航尚未执行" detail="Playwright、截图和 pageerror 数据尚未接入。" />}</div>
      <div className="cruise-screenshot"><div className="panel-head">{I({ name: "Eye", size: 16 })}巡航画面<span className="panel-head-meta">{props.cruise.errors.length ? `${props.cruise.errors.length} 条错误` : "截图待接入"}</span></div>{props.cruise.errors.length ? <ul className="cruise-error-list">{props.cruise.errors.map((error) => <li key={error.anchorId + error.message}><code>{error.anchorId}</code>{error.message}</li>)}</ul> : <Empty title="暂无真实截图" detail="截图只在 Visual Agent 执行后出现。" />}</div>
    </section>
    <section className="cruise-path">
      <div className="panel-head">{I({ name: "Workflow", size: 16 })}关键路径（契约）<span className="panel-head-meta">{path.length} 步 · 待执行</span></div>
      <ol className="cruise-path-steps">{path.map((step, index) => <li key={step}><span className="path-index">{String(index + 1).padStart(2, "0")}</span>{step}</li>)}</ol>
    </section>
    <section className="self-heal">
      <div className="panel-head">{I({ name: "ShieldPlus", size: 16 })}可视化自愈链<span className="panel-head-meta">锚点 → 源文件 → 修复 → 重跑</span></div>
      <div className="heal-chain">{props.cruise.healChain.map((node, index) => <span className="heal-node" key={node.kind}>{node.label}{index < props.cruise.healChain.length - 1 ? <span className="heal-arrow">→</span> : null}</span>)}</div>
    </section>
  </>
}
function Delivery(props: { report: ReturnType<typeof mapDelivery>; sources: SourceLedgerView | null; approvals: ApprovalRecord[]; contractHash: string; contractVersion: number; contractLockedAt: string }) {
  const events = props.report.stats[0]?.value ?? 0
  const blocked = props.report.blocked ?? []
  const generated = props.report.evolution?.generated === true
  return <div className="stage-delivery">
    <section className="delivery-main">
      <div className="report-section">
        <div className="panel-head">{I({ name: "PackageCheck", size: 16 })}证据交付<span className="panel-head-meta">真实事件 {String(events)} 条</span><button className="button button-quiet report-print" type="button" onClick={() => window.print()}>打印 / 导出</button></div>
        <div className="report-stats">{props.report.stats.map((item) => <div className="report-stat" key={item.label}><span className={"rs-value" + (typeof item.value === "number" ? "" : " is-text")}>{String(item.value)}</span><span className="rs-label">{item.label}</span></div>)}</div>
      </div>
      <div className="report-section is-grow">
        <div className="panel-head">{I({ name: "Link2", size: 16 })}证据链<span className="panel-head-meta">按 seq 排序 · 最近 8 条</span></div>
        <div className="evidence-chain">{props.report.evidence.length ? props.report.evidence.map((item) => <div className="ev-item" key={item.seq}><span className="ev-seq">{item.seq}</span><span className="ev-type"><b>{eventLabel(item.type)}</b><small>{item.type}</small></span><span className="ev-ref">{item.ref}</span></div>) : <Empty title="尚未产生证据" detail="任务事件接入后按 seq 展示。" />}</div>
      </div>
    </section>
    <aside className="delivery-side">
      {props.contractHash ? <article className="seal-card">
        <Seal hash={props.contractHash} version={props.contractVersion} lockedAt={props.contractLockedAt} size={96} />
        <div className="seal-copy">
          <b>契约已锁定</b>
          <code>{props.contractHash.slice(0, 12)}</code>
          <span>{props.contractLockedAt ? new Date(props.contractLockedAt).toLocaleString("zh-CN") : "时间未知"}</span>
        </div>
      </article> : <article className="seal-card is-empty"><div className="seal-copy"><b>尚未锁定契约</b><span>完成工段 05 后生成印章</span></div></article>}
      <div className={"report-verify" + (props.report.verified ? " is-ok" : "")} role="status">
        {props.report.verified ? I({ name: "Check", size: 16 }) : <TriangleAlert size={16} />}
        <strong>{props.report.verified ? "全部工段通过，无未验证项。" : blocked.length ? `未完成：${blocked.join("；")}` : "交付报告已生成，存在未验证项。"}</strong>
      </div>
      <article className="skillpack-card">
        <div className="sp-head"><span className="role-avatar">{I({ name: "Blocks", size: 16 })}</span><span className="sp-name">进化技能包<small>Evolution SkillPack</small></span></div>
        <div className="sp-meta">{generated ? `已生成：${props.report.evolution?.name ?? "panshi-evolution"}` : "状态：等待 RSI 数据"}</div>
        {generated ? <div className="sp-done"><Check size={14} />RSI 经验包已写入产物（evolution-skillpack.md）</div> : <div className="state-blocked" role="status"><div className="blocked-head"><TriangleAlert size={16} />未生成</div><p className="blocked-reason">没有真实攻防和修复证据时不生成进化技能。</p></div>}
      </article>
      <article className="source-card">
        <div className="panel-head">{I({ name: "Link2", size: 14 })}来源与许可证<span className="panel-head-meta">{props.sources ? props.sources.entries.length + " 条" : "待生成"}</span></div>
        {props.sources ? <ul className="source-list">{props.sources.entries.map((entry) => <li key={entry.id}><b>{entry.name}</b><span className={"license-tag" + (entry.license === "unknown" ? " is-warn" : "")}>{entry.license}</span></li>)}</ul> : <div className="panel-body-empty">Stage 9 执行后生成</div>}
        {props.sources && props.sources.unknownLicenses > 0 ? <p className="source-warn"><TriangleAlert size={13} />{props.sources.unknownLicenses} 条许可证未知，发布前需人工确认</p> : null}
        <div className="source-foot">人工审批 {props.approvals.length} 条{props.approvals.length > 0 ? " · 工段 " + [...new Set(props.approvals.map((item) => String(item.stage).padStart(2, "0")))].join("、") : ""}</div>
      </article>
      <article className="pr-draft">
        <div className="pr-head"><span>{I({ name: "GitPullRequest", size: 16 })}SkillHub PR 草稿</span><span className="pr-state">{props.report.prDraft?.state ?? "blocked"}</span></div>
        <div className="pr-body">{props.report.prDraft ? "SkillHub PR 草稿已生成，等待人工审核。" : "等待 SkillPack、来源和 Harness 证据。"}</div>
        <div className="pr-note">不自动发布；仅生成可审核产物。</div>
      </article>
    </aside>
  </div>
}
function Empty(props: { title: string; detail: string }) { return <div className="empty-state"><span>{I({ name: "Inbox", size: 21 })}</span><strong>{props.title}</strong><p>{props.detail}</p></div> }
function Composer(props: { onClose: () => void; onCreate: (title: string, summary: string) => Promise<string | null> }) {
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<() => void>(() => undefined)
  const valid = title.trim().length > 1

  async function submit(): Promise<void> {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    const failure = await props.onCreate(title.trim(), summary.trim())
    setBusy(false)
    if (failure) setError(failure)
    else props.onClose()
  }
  submitRef.current = () => { void submit() }

  useEffect(() => {
    inputRef.current?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); props.onClose() }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submitRef.current() }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [props.onClose])

  return <div className="modal-layer">
    <div className="modal-backdrop" onClick={props.onClose} aria-hidden="true" />
    <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="composer-title" aria-describedby="composer-desc">
      <header className="modal-head">
        <span className="modal-icon">{I({ name: "Rocket", size: 18 })}</span>
        <div className="modal-head-copy">
          <h2 id="composer-title">新建运行</h2>
          <p id="composer-desc">说明目标与约束，系统先生成计划；批准之前不会执行命令或写入文件。</p>
        </div>
        <button className="icon-button" type="button" aria-label="关闭" onClick={props.onClose}><X size={17} /></button>
      </header>
      <div className="modal-body">
        <label className="field">
          <span className="field-label">目标任务<span className="field-tag is-required">必填</span></span>
          <input ref={inputRef} className={"field-input" + (title.length > 0 && !valid ? " is-invalid" : "")} value={title} maxLength={200} placeholder="例如：重构采购审批与库存申领系统" onChange={(event) => setTitle(event.target.value)} />
          <span className="field-hint">一句话说明要交付什么，至少 2 个字。<span className="field-count">{title.length}/200</span></span>
        </label>
        <label className="field">
          <span className="field-label">需求与约束<span className="field-tag">选填</span></span>
          <textarea className="field-input" rows={5} maxLength={4000} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="遗产项目、需要接入的 Skill、契约范围、验收标准与已知风险。" />
          <span className="field-hint">越具体越好：涉及工段、只读或写权限、必须通过的检查。<span className="field-count">{summary.length}/4000</span></span>
        </label>
        <div className="modal-note"><LockKeyhole size={15} /><span><b>审批边界</b> · 创建后进入「需求 / 契约」工段并生成计划；批准前不执行命令、不写文件。</span></div>
        {error ? <div className="field-error" role="alert"><TriangleAlert size={15} /><span>{error}</span></div> : null}
      </div>
      <footer className="modal-foot">
        <span className="modal-hint"><kbd>Esc</kbd> 关闭 · <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 提交</span>
        <button className="button button-quiet" type="button" onClick={props.onClose} disabled={busy}>取消</button>
        <button className="button button-primary" type="button" onClick={() => void submit()} disabled={!valid || busy}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />}
          {busy ? "正在创建…" : "生成计划"}
        </button>
      </footer>
    </div>
  </div>
}
