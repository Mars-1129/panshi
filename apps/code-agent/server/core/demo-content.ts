import type { PlanDraft } from "./provider.ts"

export const DEMO_SOURCE = `export function add(left, right) {
  return left - right
}

export function multiply(left, right) {
  return left * right
}
`

export const DEMO_FIXED_SOURCE = `export function add(left, right) {
  return left + right
}

export function multiply(left, right) {
  return left * right
}
`

export const DEMO_TEST = `import { test } from "node:test"
import assert from "node:assert/strict"
import { add, multiply } from "../src/calculator.mjs"

test("add returns the sum", () => {
  assert.equal(add(2, 3), 5)
})

test("multiply returns the product", () => {
  assert.equal(multiply(4, 5), 20)
})
`

export const DEMO_PACKAGE_JSON = `${JSON.stringify(
  {
    name: "repopilot-demo-repo",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      test: "node --test",
    },
  },
  null,
  2,
)}\n`

export const DEMO_README = `# RepoPilot demo repository

A tiny fixture used to exercise the agent end to end.

The test suite fails because \`add()\` subtracts instead of adding.
Run \`npm test\` to see the failure.
`

export const DEMO_PLAN: PlanDraft = {
  summary: "Fix add() so the existing test suite passes.",
  steps: [
    { title: "Inspect the failing test", detail: "Run the repository test script and read src/calculator.mjs." },
    { title: "Correct add()", detail: "Return the sum instead of the difference." },
    { title: "Verify with real checks", detail: "Let the runtime run the repository test script." },
  ],
  files: [{ path: "src/calculator.mjs", reason: "add() subtracts instead of adding" }],
  risks: ["The fixture has no dependencies, so no install step is required."],
}
