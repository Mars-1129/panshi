import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawn, spawnSync } from "node:child_process"

// 开发态默认使用可人工核查的样例靶场（旧采购系统），而不是一次性 demo 仓库。
const sampleRepo = resolve(import.meta.dirname, "../../../samples/legacy-procurement")
process.env.REPOPILOT_REPO ||= sampleRepo
ensureSampleRepo(process.env.REPOPILOT_REPO)

const viteBin = resolve(import.meta.dirname, "../node_modules/vite/bin/vite.js")
const child = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})

/** 样例仓库必须是一个可用的 Git 仓库，否则工段会因缺少基线而无法执行。 */
function ensureSampleRepo(root: string): void {
  if (!existsSync(root)) return
  if (!existsSync(resolve(root, ".git"))) {
    run(root, ["init", "-q"])
    run(root, ["config", "user.name", "PanShi Sample"])
    run(root, ["config", "user.email", "sample@localhost"])
    run(root, ["config", "commit.gpgsign", "false"])
  }
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true })
  if (head.status !== 0) {
    run(root, ["add", "-A"])
    run(root, ["commit", "-q", "--no-verify", "-m", "chore: seed the legacy procurement sample"])
  }
}

function run(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true })
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`)
}
