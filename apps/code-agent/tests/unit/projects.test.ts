import { describe, expect, it } from "vitest"
import { buildRequirement, deriveAnchors } from "../../server/core/projects.ts"

describe("project draft", () => {
  it("derives list/create anchors per entity plus three common pages", () => {
    const anchors = deriveAnchors([
      { table: "meeting_room", label: "会议室", fields: [] },
      { table: "booking", label: "预约单", fields: [] },
    ])
    expect(anchors.map((anchor) => anchor.id)).toEqual([
      "meeting.list",
      "meeting.create",
      "booking.list",
      "booking.create",
      "approval.timeline",
      "usage.summary",
      "settings.update",
    ])
    expect(anchors.find((anchor) => anchor.id === "booking.create")?.method).toBe("post")
    expect(anchors.find((anchor) => anchor.id === "settings.update")?.scope).toBe("meeting:admin")
  })

  it("rejects invalid table names and field types", () => {
    expect(() => buildRequirement({
      product: "演示",
      entities: [{ table: "Bad Table", label: "记录", fields: [{ name: "name", type: "text" }] }],
    })).toThrow(/snake_case/)
    expect(() => buildRequirement({
      product: "演示",
      entities: [{ table: "record", label: "记录", fields: [{ name: "name", type: "jsonb" }] }],
    })).toThrow(/字段类型/)
  })

  it("builds a requirement with derived anchors", () => {
    const requirement = buildRequirement({
      product: "会议室预约系统",
      description: "会议室预约与审批",
      entities: [{ table: "booking", label: "预约单", fields: [{ name: "room_id", type: "bigint" }, { name: "status", type: "text" }] }],
    })
    expect(requirement.product).toBe("会议室预约系统")
    expect(requirement.description).toBe("会议室预约与审批")
    expect(requirement.anchors.length).toBe(5)
    expect(requirement.anchors.some((anchor) => anchor.id === "booking.create")).toBe(true)
  })
})
