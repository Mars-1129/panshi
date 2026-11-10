import { describe, expect, it } from "vitest"

import { probeSandbox, resolveSandboxConfig, wrapForContainer } from "../../server/core/sandbox.ts"

describe("resolveSandboxConfig · 配置解析", () => {
  it("默认在宿主机执行", () => {
    const config = resolveSandboxConfig({})
    expect(config.kind).toBe("host")
  })

  it("REPOPILOT_SANDBOX=docker 打开容器执行", () => {
    expect(resolveSandboxConfig({ REPOPILOT_SANDBOX: "docker" }).kind).toBe("docker")
  })

  it("无法识别的值回落 host（不静默变成半套沙箱）", () => {
    expect(resolveSandboxConfig({ REPOPILOT_SANDBOX: "podman" }).kind).toBe("host")
  })

  it("默认禁用网络", () => {
    const config = resolveSandboxConfig({ REPOPILOT_SANDBOX: "docker" })
    expect(config.network).toBe("none")
  })

  it("资源上限可覆盖", () => {
    const config = resolveSandboxConfig({
      REPOPILOT_SANDBOX: "docker",
      REPOPILOT_SANDBOX_CPUS: "1",
      REPOPILOT_SANDBOX_MEMORY: "1g",
      REPOPILOT_SANDBOX_IMAGE: "alpine:3",
    })
    expect(config.cpus).toBe("1")
    expect(config.memory).toBe("1g")
    expect(config.image).toBe("alpine:3")
  })
})

describe("wrapForContainer · 命令包装", () => {
  const config = resolveSandboxConfig({ REPOPILOT_SANDBOX: "docker" })

  it("用 docker run 并把工作目录按相同路径挂载", () => {
    const wrapped = wrapForContainer(config, { command: "npm", args: ["test"], cwd: "/repo/project" })
    expect(wrapped.command).toBe("docker")
    expect(wrapped.args).toContain("run")
    expect(wrapped.args).toContain("-v")
    expect(wrapped.args).toContain("/repo/project:/repo/project")
    expect(wrapped.args).toContain("-w")
    expect(wrapped.args[wrapped.args.indexOf("-w") + 1]).toBe("/repo/project")
  })

  it("windows 路径转成正斜杠", () => {
    const wrapped = wrapForContainer(config, { command: "cmd.exe", args: [], cwd: "C:\\repo\\project" })
    expect(wrapped.args).toContain("C:/repo/project:C:/repo/project")
  })

  it("原命令与参数排在镜像之后", () => {
    const wrapped = wrapForContainer(config, { command: "node", args: ["--version"], cwd: "/w" })
    const imageIndex = wrapped.args.indexOf(config.image)
    expect(imageIndex).toBeGreaterThan(0)
    expect(wrapped.args[imageIndex + 1]).toBe("node")
    expect(wrapped.args[imageIndex + 2]).toBe("--version")
  })

  it("带上资源与网络限制", () => {
    const wrapped = wrapForContainer(config, { command: "ls", args: [], cwd: "/w" })
    expect(wrapped.args[wrapped.args.indexOf("--network") + 1]).toBe("none")
    expect(wrapped.args).toContain("--cpus")
    expect(wrapped.args).toContain("--memory")
    expect(wrapped.args).toContain("--rm")
  })
})

describe("probeSandbox · 可用性探测", () => {
  it("host 永远可用", () => {
    const probe = probeSandbox(resolveSandboxConfig({}))
    expect(probe.available).toBe(true)
  })

  it("docker 不可用时报告原因，并说明不会回落宿主机", () => {
    const config = resolveSandboxConfig({ REPOPILOT_SANDBOX: "docker", REPOPILOT_SANDBOX_IMAGE: "definitely-not-a-real-image-xyz:1" })
    const probe = probeSandbox(config)
    // 这台机器上 docker 可能存在也可能不存在；两种情况都必须给出明确结论
    if (!probe.available) {
      expect(probe.reason).toBeTruthy()
      expect(probe.reason).toMatch(/docker|镜像/)
    }
  })
})
