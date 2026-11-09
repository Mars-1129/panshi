import { useMemo, useState, type ReactNode } from "react"
import { ArrowRight, Boxes, Database, FileSignature, LoaderCircle, Plus, Sparkles, Trash2 } from "lucide-react"
import { Dialog } from "./Dialogs"

export type ProjectEntityDraft = { table: string; label: string; fields: string }
export type ProjectDraftPayload = {
  product: string
  description: string
  entities: Array<{ table: string; label: string; fields: Array<{ name: string; type: string }> }>
}

const FIELD_TYPES = new Set(["text", "int", "bigint", "uuid", "boolean", "numeric", "timestamptz", "date"])

type Template = {
  key: string
  name: string
  product: string
  description: string
  entities: ProjectEntityDraft[]
}

const TEMPLATES: Template[] = [
  {
    key: "meeting",
    name: "会议室预约",
    product: "会议室预约系统",
    description: "会议室预约、审批与使用统计",
    entities: [
      { table: "meeting_room", label: "会议室", fields: "name:text, capacity:int, location:text, status:text" },
      { table: "booking", label: "预约单", fields: "room_id:bigint, applicant:text, start_at:timestamptz, end_at:timestamptz, status:text" },
    ],
  },
  {
    key: "repair",
    name: "设备报修",
    product: "设备报修系统",
    description: "设备台账、报修工单与维修进度",
    entities: [
      { table: "asset", label: "设备", fields: "name:text, code:text, location:text, status:text" },
      { table: "repair_order", label: "报修工单", fields: "asset_id:bigint, reporter:text, description:text, status:text" },
    ],
  },
  {
    key: "contract",
    name: "合同管理",
    product: "合同管理系统",
    description: "合同台账、审批流程与履约提醒",
    entities: [
      { table: "contract", label: "合同", fields: "title:text, amount_cents:bigint, party:text, status:text" },
      { table: "approval", label: "审批记录", fields: "contract_id:bigint, step:int, decision:text" },
    ],
  },
  {
    key: "blank",
    name: "空白",
    product: "",
    description: "",
    entities: [{ table: "record", label: "记录", fields: "title:text, status:text" }],
  },
]

function hyphen(table: string): string {
  return table.replaceAll("_", "-")
}

/** 与服务端 deriveAnchors 保持一致，供预览使用。 */
function deriveAnchors(entities: ProjectEntityDraft[]): Array<{ id: string; label: string; route: string; scope: string; method: string }> {
  const anchors: Array<{ id: string; label: string; route: string; scope: string; method: string }> = []
  for (const entity of entities) {
    const domain = entity.table.split("_")[0] || entity.table
    const label = entity.label.trim() || entity.table
    anchors.push({ id: `${domain}.list`, label: `${label}列表`, route: `/${hyphen(entity.table)}`, scope: `${domain}:read`, method: "get" })
    anchors.push({ id: `${domain}.create`, label: `新建${label}`, route: `/${hyphen(entity.table)}`, scope: `${domain}:create`, method: "post" })
  }
  const first = entities[0]?.table.split("_")[0] || "app"
  anchors.push(
    { id: "approval.timeline", label: "审批时间线", route: "/approvals", scope: `${first}:read`, method: "get" },
    { id: "usage.summary", label: "使用统计", route: "/usage", scope: `${first}:read`, method: "get" },
    { id: "settings.update", label: "系统设置", route: "/settings", scope: `${first}:admin`, method: "put" },
  )
  return anchors
}

function parseFields(text: string): { fields: Array<{ name: string; type: string }>; error: string | null } {
  const fields: Array<{ name: string; type: string }> = []
  for (const chunk of text.split(",").map((item) => item.trim()).filter(Boolean)) {
    const [name, type] = chunk.split(":").map((item) => item.trim())
    if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) return { fields, error: `字段名需为 snake_case：${chunk}` }
    if (!type || !FIELD_TYPES.has(type)) return { fields, error: `字段类型不支持：${chunk}（可用 text / int / bigint / uuid / boolean / numeric / timestamptz / date）` }
    fields.push({ name, type })
  }
  if (fields.length === 0) return { fields, error: "每个实体至少一个字段" }
  return { fields, error: null }
}

export function ProjectWizard(props: { onClose: () => void; onCreate: (draft: ProjectDraftPayload) => Promise<void> }) {
  const [templateKey, setTemplateKey] = useState("meeting")
  const [product, setProduct] = useState(TEMPLATES[0]?.product ?? "")
  const [description, setDescription] = useState(TEMPLATES[0]?.description ?? "")
  const [entities, setEntities] = useState<ProjectEntityDraft[]>(TEMPLATES[0]?.entities ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const anchors = useMemo(() => deriveAnchors(entities.filter((entity) => entity.table.trim())), [entities])
  const parsed = useMemo(() => entities.map((entity) => ({ entity, ...parseFields(entity.fields) })), [entities])
  const firstError = parsed.find((item) => item.error)?.error ?? null
  const tableError = entities.find((entity) => !/^[a-z][a-z0-9_]*$/.test(entity.table.trim())) ? "表名需为 snake_case，例如 booking 或 repair_order" : null
  const valid = product.trim().length > 0 && entities.length > 0 && !firstError && !tableError

  function applyTemplate(template: Template): void {
    setTemplateKey(template.key)
    setProduct(template.product)
    setDescription(template.description)
    setEntities(template.entities.map((entity) => ({ ...entity })))
    setError(null)
  }

  function updateEntity(index: number, patch: Partial<ProjectEntityDraft>): void {
    setEntities((current) => current.map((entity, position) => position === index ? { ...entity, ...patch } : entity))
  }

  async function submit(): Promise<void> {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await props.onCreate({
        product: product.trim(),
        description: description.trim(),
        entities: entities.map((entity) => ({
          table: entity.table.trim(),
          label: entity.label.trim() || entity.table.trim(),
          fields: parseFields(entity.fields).fields,
        })),
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setBusy(false)
    }
  }

  const footer: ReactNode = <>
    <span className="modal-hint">创建后自动运行十工段，可在任一工段查看证据</span>
    <button className="button button-secondary" type="button" onClick={props.onClose} disabled={busy}>取消</button>
    <button className="button button-primary" type="button" onClick={() => void submit()} disabled={!valid || busy}>
      {busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}创建并运行
    </button>
  </>

  return <Dialog
    title="新建项目"
    description="从一个想法开始：定义产品与数据实体，工厂会生成契约、原型与代码。"
    icon={<Boxes size={18} />}
    wide
    onClose={props.onClose}
    footer={footer}
  >
    <div className="wizard">
      <section className="wizard-step">
        <div className="wizard-step-head">
          <span className="wizard-index">01</span>
          <div><b>产品</b><p>名称与一句话说明</p></div>
        </div>
        <div className="wizard-templates">
          {TEMPLATES.map((template) => <button key={template.key} type="button" className={"template-chip" + (templateKey === template.key ? " is-active" : "")} onClick={() => applyTemplate(template)}>{template.name}</button>)}
        </div>
        <label className="field"><span className="field-label">项目名称</span><input className="field-input" value={product} onChange={(event) => setProduct(event.target.value)} placeholder="例如：会议室预约系统" /></label>
        <label className="field"><span className="field-label">一句话说明</span><input className="field-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="这个系统解决什么问题" /></label>
      </section>

      <section className="wizard-step">
        <div className="wizard-step-head">
          <span className="wizard-index">02</span>
          <div><b>数据实体</b><p>表名 snake_case；字段写成 <code>name:type</code>，逗号分隔</p></div>
        </div>
        <div className="wizard-entities">
          {entities.map((entity, index) => <div className="wizard-entity" key={index}>
            <input className="field-input is-table" value={entity.table} onChange={(event) => updateEntity(index, { table: event.target.value })} placeholder="表名 booking" aria-label="表名" />
            <input className="field-input is-label" value={entity.label} onChange={(event) => updateEntity(index, { label: event.target.value })} placeholder="中文名 预约单" aria-label="中文名" />
            <input className="field-input is-fields" value={entity.fields} onChange={(event) => updateEntity(index, { fields: event.target.value })} placeholder="room_id:bigint, start_at:timestamptz" aria-label="字段" />
            <button className="icon-button" type="button" aria-label="删除实体" disabled={entities.length <= 1} onClick={() => setEntities((current) => current.filter((_, position) => position !== index))}><Trash2 size={15} /></button>
          </div>)}
        </div>
        <button className="button button-quiet" type="button" onClick={() => setEntities((current) => [...current, { table: "", label: "", fields: "title:text, status:text" }])}><Plus size={15} />添加实体</button>
        {(tableError || firstError) && <p className="wizard-error">{tableError ?? firstError}</p>}
      </section>

      <section className="wizard-step">
        <div className="wizard-step-head">
          <span className="wizard-index">03</span>
          <div><b>页面与接口</b><p>由实体自动推导，创建后可在工段 05 查看契约</p></div>
        </div>
        <div className="wizard-anchors">
          {anchors.map((anchor) => <span className="anchor-chip" key={anchor.id}><code>{anchor.id}</code><span>{anchor.label}</span><em>{anchor.method.toUpperCase()} {anchor.route}</em></span>)}
        </div>
        <p className="wizard-note"><Database size={13} />{entities.length} 张表 · <FileSignature size={13} />{anchors.length} 个锚点 · <ArrowRight size={13} />生成契约、原型、数据库/后端/前端代码</p>
      </section>

      {error && <p className="wizard-error" role="alert">{error}</p>}
    </div>
  </Dialog>
}
