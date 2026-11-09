import { useState } from "react"
import { Bot, Check, LoaderCircle, Sparkles, Trash2 } from "lucide-react"
import { Dialog } from "./Dialogs"
import type { AiStatus } from "../runtime"

type Preset = { key: string; name: string; provider: string; baseUrl: string; model: string }

const PRESETS: Preset[] = [
  { key: "siliconflow", name: "硅基流动", provider: "siliconflow", baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V4-Flash" },
  { key: "deepseek", name: "DeepSeek", provider: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { key: "openai", name: "OpenAI", provider: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { key: "custom", name: "自定义", provider: "openai-compatible", baseUrl: "", model: "" },
]

export function AiDialog(props: {
  status: AiStatus | null
  onClose: () => void
  onSave: (input: { provider: string; baseUrl: string; model: string; apiKey: string }) => Promise<void>
  onClear: () => Promise<void>
}) {
  const initial = PRESETS.find((preset) => preset.provider === props.status?.provider) ?? PRESETS[0]!
  const [presetKey, setPresetKey] = useState(initial.key)
  const [provider, setProvider] = useState(props.status?.provider ?? initial.provider)
  const [baseUrl, setBaseUrl] = useState(props.status?.baseUrl ?? initial.baseUrl)
  const [model, setModel] = useState(props.status?.model ?? initial.model)
  const [apiKey, setApiKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function applyPreset(preset: Preset): void {
    setPresetKey(preset.key)
    setProvider(preset.provider)
    setBaseUrl(preset.baseUrl)
    setModel(preset.model)
    setError(null)
  }

  async function save(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await props.onSave({ provider, baseUrl, model, apiKey })
      props.onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  async function clear(): Promise<void> {
    if (busy) return
    setBusy(true)
    try {
      await props.onClear()
      props.onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }

  const configured = props.status?.configured === true

  return <Dialog
    title="接入 AI"
    description="由你显式提供模型 API；未接入时工段使用确定性回退，不会伪造 AI 结果。"
    icon={<Bot size={18} />}
    wide
    onClose={props.onClose}
    footer={<>
      <span className="modal-hint">密钥只保存在本机 runtime-workspace/ai.json，不会回传给浏览器</span>
      {configured && <button className="button button-quiet ai-remove" type="button" disabled={busy} onClick={() => void clear()}><Trash2 size={14} />移除</button>}
      <button className="button button-primary" type="button" disabled={busy || !apiKey || !baseUrl || !model} onClick={() => void save()}>
        {busy ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}测试并保存
      </button>
    </>}
  >
    <div className="ai-form">
      <div className={"ai-current" + (configured ? " is-ok" : "")}>
        {configured ? <Check size={15} /> : <Bot size={15} />}
        <span>{configured ? `已接入 · ${props.status?.model}（${props.status?.source === "env" ? "环境变量" : "本机配置"}）` : "尚未接入 AI"}</span>
      </div>

      <div className="ai-presets">
        {PRESETS.map((preset) => <button key={preset.key} type="button" className={"template-chip" + (presetKey === preset.key ? " is-active" : "")} onClick={() => applyPreset(preset)}>{preset.name}</button>)}
      </div>

      <label className="field"><span className="field-label">Base URL</span><input className="field-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label className="field"><span className="field-label">模型</span><input className="field-input" value={model} onChange={(event) => setModel(event.target.value)} placeholder="deepseek-ai/DeepSeek-V4-Flash" /></label>
      <label className="field"><span className="field-label">API Key</span><input className="field-input" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." autoComplete="off" /></label>
      <label className="field"><span className="field-label">Provider 标识（可留默认）</span><input className="field-input" value={provider} onChange={(event) => setProvider(event.target.value)} /></label>

      <p className="ai-note">保存前会真实调用一次 <code>/chat/completions</code> 做连通性测试；失败会直接报错，不会静默降级。</p>
      {error && <p className="wizard-error" role="alert">{error}</p>}
    </div>
  </Dialog>
}
