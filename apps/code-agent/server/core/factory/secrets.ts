import { readFile } from "node:fs/promises"
import type { WalkedFile } from "./files.ts"

const PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: "api_key", pattern: /\b(?:sk|pk|rk)-[A-Za-z0-9]{16,}\b/g },
  { kind: "aws_key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { kind: "password", pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']?(?!\$\{|<|%|\*)[^\s"',;]{6,}/gi },
  { kind: "token", pattern: /(?:token|secret|api[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']/gi },
  { kind: "jdbc_url", pattern: /jdbc:[a-z]+:\/\/[^\s"']+/gi },
  { kind: "internal_ip", pattern: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g },
]

const TEXT_EXT = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|ya?ml|toml|ini|conf|cfg|env|properties|sql|py|java|go|rs|md|txt|xml|sh|ps1)$/i

export function mask(value: string): string {
  if (value.length <= 8) return "***"
  return `${value.slice(0, 4)}***${value.slice(-4)}`
}

/** 真实扫描：只统计可读文本文件，命中即掩码，不落明文。 */
export async function scanSecrets(files: WalkedFile[]): Promise<{ scanned: number; findings: Array<{ path: string; line: number; kind: string; masked: string }>; skipped: string[] }> {
  const findings: Array<{ path: string; line: number; kind: string; masked: string }> = []
  const skipped: string[] = []
  let scanned = 0
  for (const file of files) {
    if (!TEXT_EXT.test(file.path)) {
      skipped.push(file.path)
      continue
    }
    let content = ""
    try {
      content = await readFile(file.absolute, "utf8")
    } catch {
      skipped.push(file.path)
      continue
    }
    scanned += 1
    const lines = content.split(/\r?\n/)
    for (const { kind, pattern } of PATTERNS) {
      pattern.lastIndex = 0
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? ""
        pattern.lastIndex = 0
        const match = pattern.exec(line)
        if (!match) continue
        findings.push({ path: file.path, line: index + 1, kind, masked: mask(match[0]) })
      }
    }
  }
  return { scanned, findings: findings.slice(0, 200), skipped: skipped.slice(0, 200) }
}
