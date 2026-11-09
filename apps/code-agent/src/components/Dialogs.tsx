import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowRight, Check, Compass, FileSignature, Link2, TriangleAlert, X } from "lucide-react"
import {
  BACKEND_GAPS,
  STAGE_ARTIFACTS,
  STAGES,
  STAGE_ORDER,
  type ContractKind,
  type GapStatus,
  type StageId,
  type StageView,
} from "../view-model/factory-types"

import { artifactLabel } from "../i18n"
import { getFactoryContracts, type ContractBundleView } from "../runtime"
const CONTRACTS: Record<ContractKind, string> = {
  "schema.sql": "-- schema.sql\n-- 后端契约尚未接入\n",
  "openapi.yaml": "# openapi.yaml\n# 后端契约尚未接入\n",
  "component_tree.json": "{\n  \"status\": \"waiting_for_backend\",\n  \"anchors\": [\"procurement.table\", \"procurement.create\", \"procurement.invoice_verify\", \"procurement.submit\", \"approval.timeline\", \"inventory.summary\", \"budget.dashboard\"]\n}\n",
}

/* ============================================================================
   通用弹窗：Esc 关闭、遮罩点击关闭、打开时锁定页面滚动、初始焦点在对话框。
   结构对齐 panshi.css 的 .modal-*（头 / 体 / 脚）。
   ========================================================================== */
export function Dialog(props: {
  title: string
  description?: string
  icon?: ReactNode
  wide?: boolean
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<() => void>(() => undefined)
  closeRef.current = props.onClose

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  return <div className="modal-layer">
    <div className="modal-backdrop" onClick={props.onClose} aria-hidden="true" />
    <div className={"modal-dialog" + (props.wide ? " is-wide" : "")} role="dialog" aria-modal="true" aria-label={props.title} tabIndex={-1} ref={panelRef}>
      <header className="modal-head">
        <span className="modal-icon">{props.icon}</span>
        <div className="modal-head-copy">
          <h2>{props.title}</h2>
          {props.description ? <p>{props.description}</p> : null}
        </div>
        <button className="icon-button" type="button" aria-label="关闭" onClick={props.onClose}><X size={17} /></button>
      </header>
      <div className="modal-body">{props.children}</div>
      {props.footer ? <footer className="modal-foot">{props.footer}</footer> : null}
    </div>
  </div>
}

/* ============================================================================
   产物清单：当前工段的真实输入/输出 + MVP 契约要求但尚未接入的产物
   ========================================================================== */
export function ArtifactsDialog(props: { stage: StageView; onClose: () => void }) {
  const expected = STAGE_ARTIFACTS[props.stage.stage] ?? []
  const current = [...props.stage.inputs.map((item) => ({ ...item, direction: "输入" as const })), ...props.stage.outputs.map((item) => ({ ...item, direction: "输出" as const }))]
  const names = new Set(current.map((item) => item.name))
  const missing = expected.filter((item) => !names.has(item))

  return <Dialog
    title={"工段 " + String(props.stage.stage).padStart(2, "0") + " 产物 · " + props.stage.name}
    description="只展示运行时真实产物；契约要求但尚未接入的产物单独列出，不伪造内容。"
    icon={<Compass size={18} />}
    onClose={props.onClose}
    footer={<><span className="modal-hint">当前 {current.length} 项 · 待接入 {missing.length} 项</span><button className="button button-secondary" type="button" onClick={props.onClose}>关闭</button></>}
  >
    <section className="artifact-block">
      <h3 className="artifact-title">当前产物<span>{current.length}</span></h3>
      {current.length === 0
        ? <p className="artifact-empty">尚未产生产物：该工段还没有真实运行数据。</p>
        : <ul className="artifact-list">{current.map((item) => <li key={item.direction + item.artifactId}><span className="artifact-name"><b>{artifactLabel(item.name)}</b><small>{item.name}</small></span><span className="artifact-hash">{item.hash ?? "未生成哈希"}</span><span className="artifact-state">{item.direction} · {item.state}</span></li>)}</ul>}
    </section>
    <section className="artifact-block">
      <h3 className="artifact-title">契约要求（MVP 文档）<span>{expected.length}</span></h3>
      <ul className="artifact-list">{expected.map((name) => <li key={name} className={names.has(name) ? "is-ready" : "is-pending"}><span className="artifact-name"><b>{artifactLabel(name)}</b><small>{name}</small></span><span className="artifact-hash">{names.has(name) ? "已在当前产物" : "后端尚未提供"}</span><span className="artifact-state">{names.has(name) ? "已接入" : "待接入"}</span></li>)}</ul>
    </section>
  </Dialog>
}

/* ============================================================================
   帮助：使用引导 / 后端对接缺口
   ========================================================================== */
const STATUS_TEXT: Record<GapStatus, string> = { shown: "已渲染", empty: "空态", missing: "未覆盖" }

export function HelpDialog(props: { initialTab?: "guide" | "backend"; onClose: () => void; onSelectStage: (id: StageId) => void; onCreate: () => void }) {
  const [tab, setTab] = useState<"guide" | "backend">(props.initialTab ?? "guide")
  const counts = {
    shown: BACKEND_GAPS.filter((item) => item.ui === "shown").length,
    empty: BACKEND_GAPS.filter((item) => item.ui === "empty").length,
    missing: BACKEND_GAPS.filter((item) => item.ui === "missing").length,
  }

  return <Dialog
    title="使用引导与后端对接"
    description="左侧是本产品的操作路径，右侧是前端已渲染 / 待接入的后端产物，用于和 MVP 文档逐条对表。"
    icon={<Compass size={18} />}
    wide
    onClose={props.onClose}
    footer={<><span className="modal-hint">Esc 关闭</span><button className="button button-secondary" type="button" onClick={props.onClose}>关闭</button><button className="button button-primary" type="button" onClick={props.onCreate}><ArrowRight size={15} />新建工厂运行</button></>}
  >
    <div className="dialog-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === "guide"} className={"dialog-tab" + (tab === "guide" ? " is-active" : "")} onClick={() => setTab("guide")}>使用引导</button>
      <button type="button" role="tab" aria-selected={tab === "backend"} className={"dialog-tab" + (tab === "backend" ? " is-active" : "")} onClick={() => setTab("backend")}>后端对接（{BACKEND_GAPS.length}）</button>
    </div>

    {tab === "guide" ? <div className="guide-body">
      <ol className="guide-steps">
        <li><span className="guide-num">1</span><div><strong>交代目标</strong><p>点「新建工厂运行」，用一句话说明要交付什么；系统先生成计划，不直接改代码。</p></div></li>
        <li><span className="guide-num">2</span><div><strong>审批计划</strong><p>计划卡里核对目标、文件与验证命令；未批准不执行命令、不写文件。</p></div></li>
        <li><span className="guide-num">3</span><div><strong>看证据</strong><p>每个工段右侧的产物、检查与阻断都带退出码与时间；没跑过的东西不会显示为通过。</p></div></li>
        <li><span className="guide-num">4</span><div><strong>沿工段推进</strong><p>按 00 → 09 顺序推进；当前工段未接入数据时，页面会明确写「待接入」而不是假装完成。</p></div></li>
      </ol>
      <div className="guide-shortcuts">
        <span><kbd>Ctrl</kbd><kbd>K</kbd> 新建运行</span>
        <span><kbd>Esc</kbd> 关闭弹窗</span>
        <span><kbd>Ctrl</kbd><kbd>Enter</kbd> 提交表单</span>
      </div>
      <div className="guide-stages">
        <h3 className="artifact-title">十工段链路<span>点击跳转</span></h3>
        <div className="guide-stage-grid">
          {STAGE_ORDER.map((id) => {
            const stage = STAGES.find((item) => item.id === id)
            if (!stage) return null
            return <button key={id} type="button" className="guide-stage" onClick={() => { props.onSelectStage(id); props.onClose() }}>
              <span className="guide-stage-index">{String(id).padStart(2, "0")}</span>
              <span className="guide-stage-name">{stage.name}</span>
              <span className="guide-stage-desc">{stage.desc}</span>
            </button>
          })}
        </div>
      </div>
    </div> : <div className="gap-body">
      <div className="gap-summary">
        <span className="gap-chip is-shown"><Check size={13} />已渲染 {counts.shown}</span>
        <span className="gap-chip is-empty"><CircleDashedIcon />空态 {counts.empty}</span>
        <span className="gap-chip is-missing"><TriangleAlert size={13} />未覆盖 {counts.missing}</span>
        <span className="gap-note">缺口不是缺陷清单，而是与后端的事件 / 字段对表结果。</span>
      </div>
      <div className="gap-list">
        {STAGE_ORDER.map((id) => {
          const rows = BACKEND_GAPS.filter((item) => item.stage === id)
          if (rows.length === 0) return null
          const stage = STAGES.find((item) => item.id === id)
          return <section key={id} className="gap-group">
            <h3 className="gap-group-title"><span>{String(id).padStart(2, "0")}</span>{stage?.name}</h3>
            <ul>{rows.map((item) => <li key={item.stage + item.name} className={"gap-row is-" + item.ui}>
              <span className="gap-name">{item.name}</span>
              <span className="gap-source">{item.source}</span>
              <span className={"gap-state is-" + item.ui}>{STATUS_TEXT[item.ui]}</span>
            </li>)}</ul>
          </section>
        })}
      </div>
    </div>}
  </Dialog>
}

function CircleDashedIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /></svg>
}

/* ============================================================================
   三份契约：静态占位正文 + 锁定状态；真实内容由后端契约存储提供
   ========================================================================== */
export function ContractsDialog(props: { taskId?: string; onClose: () => void }) {
  const [tab, setTab] = useState<ContractKind>("schema.sql")
  const [bundle, setBundle] = useState<ContractBundleView | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading")

  useEffect(() => {
    let alive = true
    if (!props.taskId) {
      setState("empty")
      return
    }
    setState("loading")
    getFactoryContracts(props.taskId).then((result) => {
      if (!alive) return
      setBundle(result.bundle)
      setState(result.bundle && result.bundle.contents["schema.sql"] ? "ready" : "empty")
    }).catch(() => {
      if (alive) setState("empty")
    })
    return () => { alive = false }
  }, [props.taskId])

  const content = state === "ready" ? bundle?.contents[tab] : undefined

  return <Dialog
    title="需求 / 契约 · 三份契约"
    description="契约正文、版本与哈希来自本次运行的契约存储；锁定后不可静默修改。"
    icon={<FileSignature size={18} />}
    wide
    onClose={props.onClose}
    footer={<>
      <span className="modal-hint">contractHash: {bundle?.hash ?? "未生成"} · version: {bundle?.version ?? "—"} · {bundle?.locked ? "已锁定" : "未锁定"}</span>
      <button className="button button-secondary" type="button" onClick={props.onClose}>关闭</button>
      <button className="button button-primary" type="button" disabled>{bundle?.locked ? "已锁定" : "等待锁定"}</button>
    </>}
  >
    <div className="dialog-tabs" role="tablist">
      {(Object.keys(CONTRACTS) as ContractKind[]).map((kind) => <button key={kind} type="button" role="tab" aria-selected={tab === kind} className={"dialog-tab" + (tab === kind ? " is-active" : "")} onClick={() => setTab(kind)}>{kind}</button>)}
    </div>
    {state === "loading" && <p className="contract-empty">正在读取契约…</p>}
    {state === "empty" && <p className="contract-empty">本次运行还没有锁定契约：先完成工段 05（需求 / 契约）并确认锁定。</p>}
    {content && <pre className="contract-panel">{content}</pre>}
  </Dialog>
}

export function HelpButton(props: { onClick: () => void }) {
  return <button className="icon-button" type="button" title="使用引导与后端对接" aria-label="使用引导与后端对接" onClick={props.onClick}><Link2 size={17} /></button>
}
