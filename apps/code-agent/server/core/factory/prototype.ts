import { ANCHORS } from "./procurement.ts"

export type PrototypeAnchor = { id: string; label: string; route: string; scope: string | null }

const SCREEN_NAMES: Record<string, string> = {
  "procurement.table": "采购申请台账",
  "procurement.create": "新建采购单",
  "procurement.invoice_verify": "发票验真",
  "procurement.submit": "提交审批",
  "approval.timeline": "审批时间线",
  "inventory.summary": "库存与预算",
  "budget.dashboard": "预算看板",
}

const DEFAULT_ANCHORS: PrototypeAnchor[] = ANCHORS.map((id) => ({
  id,
  label: SCREEN_NAMES[id] ?? id,
  route: id.startsWith("procurement") ? "/procurement" : id.startsWith("approval") ? "/approval" : id.startsWith("inventory") ? "/inventory" : "/budget",
  scope: `${id.split(".")[0]}:${id.split(".")[1]}`,
}))

/** 生成可点击的静态原型：只用锚点与契约，不注入任何假业务数据。 */
export function buildPrototypeHtml(version: number, hash: string, custom?: PrototypeAnchor[], product = "采购与固定资产管理"): string {
  const anchors = custom && custom.length > 0 ? custom : DEFAULT_ANCHORS
  const cards = anchors.map((anchor, index) => `<button class="screen" data-anchor="${anchor.id}" onclick="document.getElementById('detail').textContent='${anchor.id} · ${anchor.route} · ${anchor.scope ?? "public"}'">
  <span class="idx">${String(index + 1).padStart(2, "0")}</span>
  <span class="name">${anchor.label}</span>
  <span class="anchor">${anchor.id}</span>
</button>`).join("\n")

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${product} · 契约原型 v${version}</title>
<style>
  :root { --ink:#17212b; --muted:#5b6b7c; --line:#d8e0ea; --accent:#1a6fbd; --bg:#f5f7fb; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif; background:var(--bg); color:var(--ink); }
  header { padding:24px 32px; background:#fff; border-bottom:1px solid var(--line); display:flex; align-items:baseline; gap:16px; }
  header h1 { font-size:20px; margin:0; }
  header p { margin:0; color:var(--muted); font-size:13px; }
  main { padding:24px 32px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
  .screen { text-align:left; background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px 16px; cursor:pointer; display:flex; flex-direction:column; gap:6px; }
  .screen:hover { border-color:var(--accent); box-shadow:0 8px 20px -14px rgba(16,32,54,.5); }
  .idx { font-family:ui-monospace,Consolas,monospace; font-size:11px; color:var(--muted); }
  .name { font-size:15px; font-weight:600; }
  .anchor { font-family:ui-monospace,Consolas,monospace; font-size:11px; color:var(--accent); }
  footer { margin:8px 32px 32px; padding:14px 16px; border:1px dashed var(--line); border-radius:10px; color:var(--muted); font-size:12px; }
  #detail { font-family:ui-monospace,Consolas,monospace; color:var(--ink); }
</style>
</head>
<body>
<header>
  <h1>${product} · 契约原型</h1>
  <p>v${version} · ${hash.slice(0, 12)} · 由 Stage 5 生成，用于确认信息架构与锚点</p>
</header>
<main>
  <div class="grid">
${cards}
  </div>
</main>
<footer>
  静态原型，只包含锚点、路由与 RBAC，不含真实业务数据；点击任一页面查看其锚点标识。<br />
  选中：<span id="detail">未选择</span>
</footer>
</body>
</html>
`
}
