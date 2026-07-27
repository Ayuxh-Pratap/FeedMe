import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { getSafeNextPath } from "./safe-next-path.ts"

test("auth redirect paths remain same-origin", () => {
  assert.equal(getSafeNextPath("/join/invite_123?tab=comments"), "/join/invite_123?tab=comments")
  assert.equal(getSafeNextPath("//attacker.example/path"), null)
  assert.equal(getSafeNextPath("https://attacker.example/path"), null)
  assert.equal(getSafeNextPath("javascript:alert(1)"), null)
})

test("production hardening migration backfills before enforcing constraints", async () => {
  const migration = await readFile(
    new URL("../../drizzle/0008_previous_roughhouse.sql", import.meta.url),
    "utf8"
  )
  const addPatExpiry = migration.indexOf(
    'ADD COLUMN "expires_at" timestamp with time zone;'
  )
  const backfillPatExpiry = migration.indexOf(
    'SET "expires_at" = now() + interval \'90 days\''
  )
  const requirePatExpiry = migration.indexOf(
    'ALTER COLUMN "expires_at" SET NOT NULL'
  )
  const repairReports = migration.indexOf(
    'SET "status" = \'reviewing\', "updated_at" = now()'
  )
  const reportConstraint = migration.indexOf(
    'ADD CONSTRAINT "reports_workflow_status_requires_assignee"'
  )

  assert.ok(addPatExpiry >= 0)
  assert.ok(backfillPatExpiry > addPatExpiry)
  assert.ok(requirePatExpiry > backfillPatExpiry)
  assert.ok(migration.includes('SET "email_verified_at" = COALESCE'))
  assert.ok(repairReports >= 0)
  assert.ok(reportConstraint > repairReports)
})
