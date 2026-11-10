import { resolve } from "node:path"

import { defineConfig } from "vitest/config"

/**
 * 两套测试环境共存：
 *   - `tests/**` 跑 node（后端运行时、事件日志、工段执行）
 *   - `src/**`   跑 jsdom（React 组件）
 *
 * vitest 5 的 `environmentMatchGlobs` 已废弃，改用 projects。
 * 注意：src 下的 setup 只在 jsdom project 里挂，node project 不加载它
 * （node 环境没有 document，setup 会直接报错）。
 */
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    reporters: ["default"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["tests/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./src/test-setup.ts"],
        },
      },
    ],
  },
})
