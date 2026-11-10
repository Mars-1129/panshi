import { spawnSync } from "node:child_process"

/**
 * 命令执行后端。
 *
 * 默认在宿主机执行（`host`）。配置 `REPOPILOT_SANDBOX=docker` 后改为在
 * 一次性容器里执行：工作目录只挂这一个任务的工作区，默认禁用网络，
 * 限制 CPU 与内存。
 *
 * 关键取舍：**docker 不可用时不会静默回落到宿主机。**
 * 静默回落意味着用户以为在沙箱里跑，实际跑在宿主机上——安全边界会安静地
 * 消失。所以探测失败时返回 blocked，由调用方如实报告。
 *
 * 这是「单次命令隔离」，不是常驻容器池：每次 exec 起一个容器，代价是几百
 * 毫秒启动时间。真正的池化（预热、复用、端口映射）需要更长的生命周期管理，
 * 不在当前范围。
 */

export type SandboxKind = "host" | "docker"

export type SandboxConfig = {
  kind: SandboxKind
  image: string
  network: string
  cpus: string
  memory: string
}

const DEFAULT_IMAGE = "node:24-bookworm-slim"

export function resolveSandboxConfig(env: NodeJS.ProcessEnv = process.env): SandboxConfig {
  const raw = (env.REPOPILOT_SANDBOX ?? "").trim().toLowerCase()
  const kind: SandboxKind = raw === "docker" ? "docker" : "host"
  return {
    kind,
    image: (env.REPOPILOT_SANDBOX_IMAGE ?? "").trim() || DEFAULT_IMAGE,
    // 默认禁用网络：模型驱动的命令不该有外网访问
    network: (env.REPOPILOT_SANDBOX_NETWORK ?? "").trim() || "none",
    cpus: (env.REPOPILOT_SANDBOX_CPUS ?? "").trim() || "2",
    memory: (env.REPOPILOT_SANDBOX_MEMORY ?? "").trim() || "4g",
  }
}

export type SandboxProbe =
  | { available: true; kind: SandboxKind; detail: string }
  | { available: false; kind: SandboxKind; reason: string }

/** 探测沙箱是否真的可用。host 永远可用；docker 需要 CLI 与镜像都在。 */
export function probeSandbox(config: SandboxConfig): SandboxProbe {
  if (config.kind === "host") {
    return { available: true, kind: "host", detail: "命令在宿主机执行" }
  }
  const version = spawnSync("docker", ["--version"], { encoding: "utf8", windowsHide: true, timeout: 8000 })
  if (version.error || version.status !== 0) {
    return {
      available: false,
      kind: "docker",
      reason: "docker CLI 不可用；不会回落到宿主机执行（那会让沙箱边界静默消失）",
    }
  }
  const image = spawnSync("docker", ["image", "inspect", config.image], { encoding: "utf8", windowsHide: true, timeout: 15_000 })
  if (image.status !== 0) {
    return {
      available: false,
      kind: "docker",
      reason: `镜像 ${config.image} 不存在；先执行 docker pull ${config.image}`,
    }
  }
  return {
    available: true,
    kind: "docker",
    detail: `命令在一性容器内执行（${config.image}，网络 ${config.network}，${config.cpus} CPU / ${config.memory}）`,
  }
}

export type SandboxCommand = {
  command: string
  args: string[]
}

/**
 * 把一条命令包成容器调用。
 *
 * 工作区按**相同绝对路径**挂载，这样 cwd、脚本里的绝对路径、错误信息里的
 * 路径都和宿主机一致——否则日志里的路径和用户看到的对不上。
 *
 * 只在 Linux 容器里跑（--platform linux）。Windows 宿主机路径需要转换成
 * docker 能识别的形式，这里统一用正斜杠。
 */
export function wrapForContainer(config: SandboxConfig, input: SandboxCommand & { cwd: string }): SandboxCommand {
  const mountPath = input.cwd.replace(/\\/g, "/")
  const args = [
    "run",
    "--rm",
    "-i",
    "--network",
    config.network,
    "--cpus",
    config.cpus,
    "--memory",
    config.memory,
    // 容器内的工作目录与宿主机一致，路径不需要翻译
    "-v",
    `${mountPath}:${mountPath}`,
    "-w",
    mountPath,
    // 容器里没有更外面的挂载，root 只影响容器的 tmpfs
    "--user",
    "root",
    config.image,
    input.command,
    ...input.args,
  ]
  return { command: "docker", args }
}
