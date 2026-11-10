/**
 * 组件测试的全局初始化。
 *
 * - 注册 jest-dom 的断言（toBeInTheDocument 等）
 * - 每个用例结束后清空 document.body，避免相邻用例看到上一个用例的节点
 *   （vitest 的 jsdom 环境默认不会清，Testing Library 的 auto-cleanup 只在
 *   全局注入 afterEach 时生效，这里显式做一次更可靠）
 */
import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
  cleanup()
})
