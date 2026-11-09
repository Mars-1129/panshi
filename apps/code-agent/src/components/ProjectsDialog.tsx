import { useState } from "react"
import { FolderOpen, LoaderCircle, Plus, Trash2 } from "lucide-react"
import { Dialog } from "./Dialogs"

export type ProjectRow = { id: string; product: string; path: string; anchors?: number; updatedAt?: string }

export function ProjectsDialog(props: {
  projects: ProjectRow[]
  currentPath: string | null
  onOpen: (path: string) => void
  onDelete: (id: string) => Promise<void>
  onNew: () => void
  onClose: () => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function remove(id: string): Promise<void> {
    setBusy(id)
    try {
      await props.onDelete(id)
      setConfirmId(null)
    } finally {
      setBusy(null)
    }
  }

  return <Dialog
    title="项目"
    description="打开或删除由工厂创建的项目。删除会移除整个项目目录，不可恢复；当前项目需先切换。"
    icon={<FolderOpen size={18} />}
    wide
    onClose={props.onClose}
    footer={<>
      <span className="modal-hint">项目位于 runtime-workspace/projects/，每个项目是一个独立 Git 仓库</span>
      <button className="button button-primary" type="button" onClick={props.onNew}><Plus size={15} />新建项目</button>
    </>}
  >
    <div className="project-list">
      {props.projects.length === 0 && <p className="project-empty">还没有项目。点「新建项目」创建第一个，或直接用当前工作区体验。</p>}
      {props.projects.map((project) => {
        const current = props.currentPath === project.path
        return <div className="project-row" key={project.id}>
          <div className="project-info">
            <b>{project.product}</b>
            <span>{project.id} · {project.path}</span>
          </div>
          <div className="project-actions">
            {current
              ? <span className="state-chip is-ok">当前项目</span>
              : <button className="button button-secondary" type="button" onClick={() => props.onOpen(project.path)}>打开</button>}
            {!current && (confirmId === project.id
              ? <button className="button button-secondary project-delete" type="button" disabled={busy === project.id} onClick={() => void remove(project.id)}>
                {busy === project.id ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}确认删除
              </button>
              : <button className="button button-quiet project-delete" type="button" onClick={() => setConfirmId(project.id)}><Trash2 size={14} />删除</button>)}
          </div>
        </div>
      })}
    </div>
  </Dialog>
}
