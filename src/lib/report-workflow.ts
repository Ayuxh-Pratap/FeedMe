import type {
  WorkspaceReportNoteKind,
  WorkspaceReportStatus,
} from "@/lib/reports"

const assignedMemberTransitionTarget = {
  assigned: "in_progress",
  in_progress: "ready_for_review",
} as const satisfies Partial<Record<WorkspaceReportStatus, WorkspaceReportStatus>>

const assignedMemberNoteKindsByStatus = {
  submitted: [],
  reviewing: [],
  accepted: [],
  needs_info: [],
  duplicate: [],
  rejected: [],
  assigned: ["clarification_request", "blocker"],
  in_progress: ["work_note", "clarification_request", "blocker"],
  ready_for_review: ["work_note"],
  resolved: [],
  archived: [],
} as const satisfies Record<
  WorkspaceReportStatus,
  readonly WorkspaceReportNoteKind[]
>

export function canAssignedMemberTransition(
  fromStatus: WorkspaceReportStatus,
  toStatus: WorkspaceReportStatus
) {
  return assignedMemberTransitionTarget[
    fromStatus as keyof typeof assignedMemberTransitionTarget
  ] === toStatus
}

export function getAssignedMemberNoteKinds(status: WorkspaceReportStatus) {
  return assignedMemberNoteKindsByStatus[status]
}

export function canAssignedMemberCreateNote(
  status: WorkspaceReportStatus,
  kind: WorkspaceReportNoteKind
) {
  return getAssignedMemberNoteKinds(status).some((allowedKind) => allowedKind === kind)
}
