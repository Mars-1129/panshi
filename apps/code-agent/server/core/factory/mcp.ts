import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createInterface } from "node:readline"

export type McpTool = { name: string; description: string; inputSchema: Record<string, unknown> }

/** 本地 MCP 验毒靶子：newline-delimited JSON-RPC over stdio（无第三方依赖）。 */
export const MCP_SERVER_SOURCE = `import { createInterface } from "node:readline"
const rl = createInterface({ input: process.stdin })
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\\n")
const tools = [{
  name: "verify_invoice",
  description: "核验增值税发票真伪并返回税额（分）",
  inputSchema: {
    type: "object",
    properties: { invoiceNo: { type: "string" }, amountCents: { type: "number" } },
    required: ["invoiceNo"],
  },
}]
rl.on("line", (line) => {
  if (!line.trim()) return
  let msg
  try { msg = JSON.parse(line) } catch { return }
  if (msg.method === "initialize") {
    send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "vat-invoice-mcp", version: "0.1.0" } } })
    return
  }
  if (msg.method === "tools/list") {
    send({ jsonrpc: "2.0", id: msg.id, result: { tools } })
    return
  }
  if (msg.method === "tools/call") {
    const args = msg.params?.arguments ?? {}
    if (!args.invoiceNo) {
      send({ jsonrpc: "2.0", id: msg.id, error: { code: -32602, message: "invoiceNo is required" } })
      return
    }
    // 免税发票故意返回 null，用来验证 wrapper 的空值防护
    const taxAmount = args.invoiceNo.endsWith("FREE") ? null : Math.round((args.amountCents ?? 10000) * 0.13)
    send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify({ invoiceNo: args.invoiceNo, taxAmount, verified: true }) }] } })
    return
  }
  send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } })
})
`

export class McpClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  private seq = 0
  private rl: ReturnType<typeof createInterface> | null = null

  private readonly scriptPath: string
  private readonly timeoutMs: number

  constructor(scriptPath: string, timeoutMs = 10_000) {
    this.scriptPath = scriptPath
    this.timeoutMs = timeoutMs
  }

  async start(): Promise<void> {
    this.child = spawn(process.execPath, [this.scriptPath], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true })
    this.rl = createInterface({ input: this.child.stdout })
    this.rl.on("line", (line) => {
      if (!line.trim()) return
      let message: { id?: number; result?: unknown; error?: { message?: string } }
      try {
        message = JSON.parse(line)
      } catch {
        return
      }
      if (typeof message.id !== "number") return
      const entry = this.pending.get(message.id)
      if (!entry) return
      this.pending.delete(message.id)
      if (message.error) entry.reject(new Error(`MCP error: ${message.error.message ?? "unknown"}`))
      else entry.resolve(message.result)
    })
    this.child.stderr.on("data", () => undefined)
    this.child.on("exit", (code) => {
      for (const [, entry] of this.pending) entry.reject(new Error(`MCP server exited (${code ?? "?"})`))
      this.pending.clear()
    })
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const child = this.child
    if (!child) return Promise.reject(new Error("MCP client not started"))
    const id = (this.seq += 1)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`MCP request timed out: ${method}`))
      }, this.timeoutMs)
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value) },
        reject: (error) => { clearTimeout(timer); reject(error) },
      })
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`)
    })
  }

  close(): void {
    this.rl?.close()
    this.child?.kill()
    this.child = null
  }
}

/** 规范化 tools/list 结果，任何形状异常都抛错（不猜测）。 */
export function normalizeTools(result: unknown): McpTool[] {
  const value = result as { tools?: Array<{ name?: unknown; description?: unknown; inputSchema?: unknown }> } | null
  if (!Array.isArray(value?.tools)) throw new Error("tools/list 返回结构不合法")
  return value.tools.map((tool) => {
    if (typeof tool.name !== "string" || !tool.name) throw new Error("工具缺少 name")
    return {
      name: tool.name,
      description: typeof tool.description === "string" ? tool.description : "",
      inputSchema: (tool.inputSchema as Record<string, unknown> | undefined) ?? { type: "object", properties: {} },
    }
  })
}

export function buildWrapperSource(tool: McpTool, serverPath: string): string {
  return `// 自动生成的 MCP wrapper：${tool.name}
// 强制：超时、异常捕获、数值字段非 null、统一 JSON 输出
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"

const SERVER = ${JSON.stringify(serverPath)}
const TIMEOUT_MS = 8000

function callTool(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "inherit"], windowsHide: true })
    const rl = createInterface({ input: child.stdout })
    const timer = setTimeout(() => { child.kill(); reject(new Error("timeout")) }, TIMEOUT_MS)
    rl.on("line", (line) => {
      let msg
      try { msg = JSON.parse(line) } catch { return }
      if (msg.id !== 1) return
      clearTimeout(timer)
      rl.close()
      child.kill()
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    })
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: ${JSON.stringify(tool.name)}, arguments: args } }) + "\\n")
  })
}

const input = JSON.parse(process.argv[2] ?? "{}")
try {
  const result = await callTool(input)
  const text = result?.content?.[0]?.text ?? "{}"
  const data = JSON.parse(text)
  console.log(JSON.stringify({
    ok: true,
    invoiceNo: String(data.invoiceNo ?? ""),
    taxAmount: Number(data.taxAmount ?? 0),
    verified: Boolean(data.verified),
  }))
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
}
`
}
