import assert from "node:assert/strict"
import test from "node:test"

import { bulkCreateTasksInputSchema } from "../server/reports/validation.ts"

const task = {
  clientTaskId: "import:sprint_7:task_12",
  title: "Fix checkout overlap",
  description: "The checkout action overlaps the coupon input on tablet.",
}

test("bulk MCP tasks enforce defaults, idempotency keys, and one assignee identity", () => {
  const parsed = bulkCreateTasksInputSchema.parse({ tasks: [task] })

  assert.equal(parsed.tasks[0].severity, "medium")
  assert.equal(parsed.tasks[0].type, "bug")
  assert.equal(parsed.tasks[0].url, undefined)
  assert.equal(
    bulkCreateTasksInputSchema.safeParse({
      tasks: [
        {
          ...task,
          implementationBrief: {
            expectedBehavior: "The checkout action remains visible.",
          },
        },
      ],
    }).success,
    true
  )
  assert.equal(
    bulkCreateTasksInputSchema.safeParse({
      tasks: [{ ...task, implementationBrief: {} }],
    }).success,
    true
  )

  assert.equal(
    bulkCreateTasksInputSchema.safeParse({ tasks: [task, task] }).success,
    false
  )
  assert.equal(
    bulkCreateTasksInputSchema.safeParse({
      tasks: [
        {
          ...task,
          assignee: {
            email: "developer@example.com",
            userId: "d5ffbcb8-dfed-4a03-94b4-6ffbb3cde536",
          },
        },
      ],
    }).success,
    false
  )
  assert.equal(
    bulkCreateTasksInputSchema.safeParse({
      tasks: [{ ...task, assets: [] }],
    }).success,
    false
  )
})
