/**
 * 视图状态与 URL 的同步。
 *
 * 之前 view / stageId 只存在 useState 里：刷新回到概览 + 工段 00，
 * 也没法把"我正在看工段 08 的证据"发给同事。
 *
 * 这里用 hash 而不是 pushState：内置 Web 已经有一套基于 pathname 的路由
 * （wouter），在 pathname 上再叠一层会让两条路由表互相打架。hash 完全在
 * 客户端，不触发服务端路由，也不会和 solution 路由抢路径。
 *
 * 形如：`#/stage/8`、`#/overview`
 */

export type ViewState = { view: "overview" } | { view: "stage"; stage: number }

export const DEFAULT_VIEW: ViewState = { view: "overview" }

/** 从 hash 解析视图状态。认不出来就回默认值，不抛错（用户可能手改了地址）。 */
export function parseViewHash(hash: string): ViewState {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  const match = /^\/stage\/([0-9])$/.exec(raw)
  if (match) {
    const stage = Number(match[1])
    if (Number.isInteger(stage) && stage >= 0 && stage <= 9) return { view: "stage", stage }
  }
  return DEFAULT_VIEW
}

/** 把视图状态编码成 hash。概览不写 hash，保持地址干净。 */
export function formatViewHash(state: ViewState): string {
  return state.view === "stage" ? `#/stage/${state.stage}` : ""
}

/** 当前地址的 hash。测试里可以直接传值，不依赖 window。 */
export function currentViewHash(): string {
  if (typeof window === "undefined") return ""
  return window.location.hash
}
