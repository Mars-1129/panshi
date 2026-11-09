import { useEffect } from "react"
import { X } from "lucide-react"
import { eventLabel } from "../i18n"
import type { AgentEvent } from "../types"

export function EvidenceDrawer(props: { stage: number; events: AgentEvent[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [props])

  const scoped = props.events
    .filter((event) => {
      const stageId = Number((event.payload as Record<string, unknown>).stageId)
      return Number.isInteger(stageId) ? stageId === props.stage : true
    })
    .slice(-80)
    .reverse()

  return <div className="ed-backdrop" role="presentation" onClick={props.onClose}>
    <aside className="ed-panel" role="dialog" aria-label={`工段 ${props.stage} 证据`} onClick={(event) => event.stopPropagation()}>
      <header className="ed-head">
        <div>
          <h2>证据 · 工段 {String(props.stage).padStart(2, "0")}</h2>
          <p>按时间倒序 · 共 {scoped.length} 条事件</p>
        </div>
        <button className="icon-button" type="button" aria-label="关闭证据" onClick={props.onClose}><X size={16} /></button>
      </header>
      <div className="ed-list">
        {scoped.length === 0 && <p className="ed-empty">该工段还没有事件。</p>}
        {scoped.map((event) => <details className="ed-item" key={event.seq}>
          <summary>
            <span className="ed-seq">{event.seq}</span>
            <span className="ed-type">{eventLabel(event.type)}</span>
            <span className="ed-time">{event.time.slice(11, 19)}</span>
          </summary>
          <pre className="ed-json">{JSON.stringify(event.payload, null, 2)}</pre>
        </details>)}
      </div>
    </aside>
  </div>
}
