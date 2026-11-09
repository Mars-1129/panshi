import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import type { WalkedFile } from "./files.ts"

export type Slice = { sliceId: string; path: string; startLine: number; endLine: number; name: string; calls: string[] }
export type Rule = { ruleId: string; path: string; line: number; summary: string; confidence: number; kind: "threshold" | "branch" | "state" | "sql" | "other" }

const ANALYZABLE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])
const SQL_EXT = new Set([".sql"])

type TsModule = typeof import("typescript")

async function loadTs(): Promise<TsModule | null> {
  try {
    return await import("typescript")
  } catch {
    return null
  }
}

/**
 * 真实静态分析：TypeScript Compiler API 解析 TS/JS，抽取函数切片、调用关系与
 * 可核对的业务规则（阈值 / 分支 / 状态 / SQL）。方言或动态行为记入 unanalyzed。
 */
export async function analyzeRepo(files: WalkedFile[]): Promise<{ slices: Slice[]; rules: Rule[]; unanalyzed: Array<{ path: string; reason: string }>; callGraph: Record<string, string[]> }> {
  const ts = await loadTs()
  const slices: Slice[] = []
  const rules: Rule[] = []
  const unanalyzed: Array<{ path: string; reason: string }> = []
  const callGraph: Record<string, string[]> = {}

  for (const file of files) {
    const ext = extname(file.path).toLowerCase()
    if (SQL_EXT.has(ext)) {
      const content = await readFile(file.absolute, "utf8")
      content.split(/\r?\n/).forEach((line, index) => {
        if (/\b(?:CREATE|ALTER)\s+TABLE\b/i.test(line)) {
          rules.push({ ruleId: `sql_${rules.length + 1}`, path: file.path, line: index + 1, summary: line.trim().slice(0, 160), confidence: 0.9, kind: "sql" })
        }
      })
      continue
    }
    if (!ANALYZABLE.has(ext)) {
      if (/\.(py|java|go|rs|php|rb|cs|kt)$/i.test(file.path)) unanalyzed.push({ path: file.path, reason: "语言解析器未接入（MVP 仅支持 TS/JS AST）" })
      continue
    }
    if (!ts) {
      unanalyzed.push({ path: file.path, reason: "typescript 解析器不可用" })
      continue
    }
    let content = ""
    try {
      content = await readFile(file.absolute, "utf8")
    } catch {
      unanalyzed.push({ path: file.path, reason: "文件不可读" })
      continue
    }
    const source = ts.createSourceFile(file.path, content, ts.ScriptTarget.ES2022, true, ext.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const lineOf = (node: import("typescript").Node): number => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
    const textOf = (node: import("typescript").Node): string => node.getText(source).replace(/\s+/g, " ").slice(0, 160)

    const visitFunctions = (node: import("typescript").Node): void => {
      let name: string | null = null
      let body: import("typescript").Node | undefined
      if (ts.isFunctionDeclaration(node) && node.name) { name = node.name.text; body = node.body }
      else if (ts.isMethodDeclaration(node) && node.name) { name = node.name.getText(source); body = node.body }
      else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) { name = node.name.text; body = node.initializer.body }
      if (name && body) {
        const calls: string[] = []
        const walkCalls = (inner: import("typescript").Node): void => {
          if (ts.isCallExpression(inner)) {
            const callee = inner.expression.getText(source)
            if (callee && !calls.includes(callee)) calls.push(callee.slice(0, 80))
          }
          ts.forEachChild(inner, walkCalls)
        }
        walkCalls(body)
        const sliceId = `slice_${slices.length + 1}`
        slices.push({
          sliceId,
          path: file.path,
          startLine: lineOf(node),
          endLine: source.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
          name,
          calls,
        })
        callGraph[name] = calls
      }
      ts.forEachChild(node, visitFunctions)
    }
    visitFunctions(source)

    const visitRules = (node: import("typescript").Node): void => {
      if (ts.isIfStatement(node)) {
        const condition = node.expression
        const numeric = /[<>=]=?\s*\d|\d+\s*[<>=]=?/.test(condition.getText(source))
        rules.push({
          ruleId: `rule_${rules.length + 1}`,
          path: file.path,
          line: lineOf(node),
          summary: `IF ${textOf(condition)}`,
          confidence: numeric ? 0.85 : 0.6,
          kind: numeric ? "threshold" : "branch",
        })
      }
      if (ts.isBinaryExpression(node) && [ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken].includes(node.operatorToken.kind)) {
        if (/^\d+$/.test(node.right.getText(source))) {
          rules.push({
            ruleId: `rule_${rules.length + 1}`,
            path: file.path,
            line: lineOf(node),
            summary: `阈值 ${textOf(node)}`,
            confidence: 0.8,
            kind: "threshold",
          })
        }
      }
      if (ts.isStringLiteral(node) && /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(node.text)) {
        rules.push({ ruleId: `rule_${rules.length + 1}`, path: file.path, line: lineOf(node), summary: textOf(node), confidence: 0.9, kind: "sql" })
      }
      ts.forEachChild(node, visitRules)
    }
    visitRules(source)
    if (rules.length >= 200) break
  }

  return { slices: slices.slice(0, 200), rules: rules.slice(0, 200), unanalyzed, callGraph }
}
