import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Empty, WorkflowRibbon } from "../App"
import type { StageId, StageStatus } from "../view-model/factory-types"

const STAGES: Array<{ stage: StageId; name: string; status: StageStatus; selected: boolean }> = [
  { stage: 0, name: "接入基线", status: "done", selected: false },
  { stage: 1, name: "环境救活", status: "active", selected: false },
  { stage: 2, name: "业务考古", status: "blocked", selected: false },
  { stage: 3, name: "二进制对拍", status: "not_applicable", selected: true },
  { stage: 4, name: "技能封装", status: "pending", selected: false },
]

function renderRibbon(stages = STAGES, onSelect = vi.fn()) {
  render(<WorkflowRibbon stages={stages} onSelect={onSelect} />)
  return onSelect
}

describe("WorkflowRibbon · 十工段工作流", () => {
  it("每个工段一个按钮，且带状态文字", () => {
    renderRibbon()
    expect(screen.getByRole("button", { name: /工段 0 接入基线：通过/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /工段 1 环境救活：执行中/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /工段 2 业务考古：阻断/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /工段 4 技能封装：待运行/ })).toBeInTheDocument()
  })

  it("不适用的工段读作「不适用」，不读成通过或阻断", () => {
    renderRibbon()
    const node = screen.getByRole("button", { name: /工段 3 二进制对拍：不适用/ })
    expect(node).toBeInTheDocument()
    expect(node.textContent).toContain("不适用")
  })

  it("点击工段会回调对应 id", async () => {
    const onSelect = renderRibbon()
    await userEvent.click(screen.getByRole("button", { name: /工段 4 技能封装/ }))
    expect(onSelect).toHaveBeenCalledWith(4)
  })

  it("选中的工段带 is-current 标记", () => {
    renderRibbon()
    const node = screen.getByRole("button", { name: /工段 3 二进制对拍/ })
    expect(node.closest("li")?.className).toContain("is-current")
  })

  it("十个工段全部渲染（不含图例文字）", () => {
    const ten = Array.from({ length: 10 }, (_, index) => ({
      stage: index as StageId,
      name: `工段${index}`,
      status: "done" as StageStatus,
      selected: false,
    }))
    renderRibbon(ten)
    expect(screen.getAllByRole("button")).toHaveLength(10)
  })

  it("图例说明十段总数", () => {
    renderRibbon()
    expect(screen.getByText(/共 10 段/)).toBeInTheDocument()
  })
})

describe("Empty · 空态", () => {
  it("同时展示标题与说明，说明不会被省略", () => {
    render(<Empty title="暂无阻断记录" detail="规则已定义，事件尚未接入。" />)
    expect(screen.getByText("暂无阻断记录")).toBeInTheDocument()
    expect(screen.getByText("规则已定义，事件尚未接入。")).toBeInTheDocument()
  })
})
