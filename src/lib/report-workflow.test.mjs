import assert from "node:assert/strict"
import test from "node:test"

import {
  canAssignedMemberCreateNote,
  canAssignedMemberTransition,
  getAssignedMemberNoteKinds,
} from "./report-workflow.ts"

test("assigned implementation members follow the exact status chain", () => {
  assert.equal(canAssignedMemberTransition("assigned", "in_progress"), true)
  assert.equal(
    canAssignedMemberTransition("in_progress", "ready_for_review"),
    true
  )

  assert.equal(canAssignedMemberTransition("assigned", "ready_for_review"), false)
  assert.equal(canAssignedMemberTransition("ready_for_review", "in_progress"), false)
  assert.equal(canAssignedMemberTransition("resolved", "in_progress"), false)
  assert.equal(canAssignedMemberTransition("in_progress", "in_progress"), false)
})

test("developer note permissions are state-aware", () => {
  assert.deepEqual(getAssignedMemberNoteKinds("assigned"), [
    "clarification_request",
    "blocker",
  ])
  assert.deepEqual(getAssignedMemberNoteKinds("in_progress"), [
    "work_note",
    "clarification_request",
    "blocker",
  ])
  assert.deepEqual(getAssignedMemberNoteKinds("ready_for_review"), ["work_note"])
  assert.deepEqual(getAssignedMemberNoteKinds("resolved"), [])

  assert.equal(
    canAssignedMemberCreateNote("assigned", "clarification_request"),
    true
  )
  assert.equal(canAssignedMemberCreateNote("assigned", "work_note"), false)
  assert.equal(canAssignedMemberCreateNote("ready_for_review", "blocker"), false)
  assert.equal(canAssignedMemberCreateNote("resolved", "work_note"), false)
})
