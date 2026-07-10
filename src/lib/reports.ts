export type WorkspaceReportSeverity = "low" | "medium" | "high" | "urgent"

export type WorkspaceReportStatus =
  | "submitted"
  | "reviewing"
  | "accepted"
  | "needs_info"
  | "duplicate"
  | "rejected"
  | "assigned"
  | "in_progress"
  | "ready_for_review"
  | "resolved"
  | "archived"

export type WorkspaceReportType =
  | "bug"
  | "ux"
  | "design"
  | "copy"
  | "performance"
  | "accessibility"

export type WorkspaceReportScreenshot = {
  id: string
  label: string
  kind: "page" | "annotated"
  url?: string
  thumbnailUrl?: string
  width?: number | null
  height?: number | null
}

export type WorkspaceReportImplementationBrief = {
  acceptanceCriteria: string[]
  implementationNotes?: string | null
  constraintsNonGoals: string[]
  expectedBehavior?: string | null
  referenceLinks: Array<{
    label?: string | null
    url: string
  }>
  reviewChecklist: string[]
  updatedAt?: string | null
  updatedBy?: {
    id: string
    name: string
    email: string
    avatarUrl?: string | null
  } | null
}

export type WorkspaceReportNoteKind =
  | "work_note"
  | "blocker"
  | "clarification_request"
  | "clarification"
  | "review_note"

export type WorkspaceReportActivityActor = {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
}

export type WorkspaceReportActivityItem =
  | {
      id: string
      type: "note"
      kind: WorkspaceReportNoteKind
      body: string
      createdAt: string
      createdAgo: string
      author?: WorkspaceReportActivityActor | null
    }
  | {
      id: string
      type: "status"
      fromStatus?: WorkspaceReportStatus | null
      toStatus: WorkspaceReportStatus
      note?: string | null
      createdAt: string
      createdAgo: string
      actor?: WorkspaceReportActivityActor | null
    }

export type WorkspaceReportComment = {
  id: string
  parentCommentId?: string | null
  body: string
  createdAt: string
  createdAgo: string
  editedAt?: string | null
  isDeleted?: boolean
  author?: WorkspaceReportActivityActor | null
  mentions: WorkspaceReportActivityActor[]
  reactions: WorkspaceReportCommentReactionSummary[]
  replyCount: number
  replies: WorkspaceReportComment[]
  repliesPageInfo?: WorkspaceReportCommentsPageInfo
}

export type WorkspaceReportCommentReactionKind =
  | "seen"
  | "agree"
  | "blocked"
  | "helpful"

export type WorkspaceReportCommentReactionSummary = {
  reaction: WorkspaceReportCommentReactionKind
  count: number
  reactedByCurrentUser: boolean
}

export type WorkspaceReportCommentsPageInfo = {
  hasNextPage: boolean
  limit: number
  nextCursor: string | null
}

export type WorkspaceReport = {
  id: string
  reporterUserId?: string | null
  assigneeUserId?: string | null
  title: string
  summary: string
  severity: WorkspaceReportSeverity
  status: WorkspaceReportStatus
  type: WorkspaceReportType
  domain: string
  url: string
  browser: string
  device: string
  viewport: string
  capturedAt: string
  capturedAtIso?: string
  capturedAgo: string
  screenshots: WorkspaceReportScreenshot[]
  selectedElement: {
    tag: string
    selector: string
    text?: string
    attributes: Record<string, string>
  }
  feedback: {
    message: string
    reporterName: string
    reporterEmail: string
    reporterAvatarUrl?: string | null
  }
  developerPrompt: string
  implementationBrief?: WorkspaceReportImplementationBrief | null
  activity?: WorkspaceReportActivityItem[]
  comments?: WorkspaceReportComment[]
  commentsPageInfo?: WorkspaceReportCommentsPageInfo
  assignee?: {
    name: string
    initials: string
    avatarUrl?: string | null
  }
  commentsCount: number
}

export type WorkspaceReportSummary = WorkspaceReport
export type WorkspaceReportDetail = WorkspaceReport

export type WorkspaceReportStatusFilter =
  | "all"
  | "open"
  | "in_progress"
  | "resolved"

export type WorkspaceReportSort =
  | "newest"
  | "oldest"
  | "priority"
  | "comments"

export type WorkspaceReportScope = "assigned" | "reported"

export type WorkspaceReportsPageInfo = {
  hasNextPage: boolean
  limit: number
  nextCursor: string | null
}

export type WorkspaceReportsListResponse = {
  reports: WorkspaceReportSummary[]
  pageInfo: WorkspaceReportsPageInfo
}

export type WorkspaceReportCounts = {
  all: number
  assignedToMe: number
  inProgress: number
  open: number
  reportedByMe: number
  resolved: number
}

export type WorkspaceReportCountsResponse = {
  counts: WorkspaceReportCounts
}

export type WorkspaceReportDetailResponse = {
  report: WorkspaceReportDetail
}

export type WorkspaceReportCommentsResponse = {
  comments: WorkspaceReportComment[]
  pageInfo: WorkspaceReportCommentsPageInfo
}

export type WorkspaceReportCommentMutationResponse = {
  comment: WorkspaceReportComment
  report: Pick<WorkspaceReportDetail, "id" | "commentsCount">
}

export const activeReportStatuses = new Set<WorkspaceReportStatus>([
  "submitted",
  "reviewing",
  "accepted",
  "needs_info",
])

export const progressReportStatuses = new Set<WorkspaceReportStatus>([
  "assigned",
  "in_progress",
  "ready_for_review",
])

export const assignmentLockedReportStatuses = new Set<WorkspaceReportStatus>([
  "in_progress",
  "ready_for_review",
  "resolved",
  "archived",
])

export function isWorkspaceReportAssignmentLocked(
  status: WorkspaceReportStatus
) {
  return assignmentLockedReportStatuses.has(status)
}

export function isOpenWorkspaceReport(report: WorkspaceReport) {
  return activeReportStatuses.has(report.status)
}

export function isInProgressWorkspaceReport(report: WorkspaceReport) {
  return progressReportStatuses.has(report.status)
}

export function getReportStatusLabel(status: WorkspaceReportStatus) {
  return status.replace(/_/g, " ")
}

export function formatReportCapturedAt(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value

  if (Number.isNaN(date.getTime())) {
    return "Unknown"
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatReportCapturedAgo(value: Date | string, now = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value
  const diffMs = now.getTime() - date.getTime()

  if (Number.isNaN(diffMs) || diffMs < 0) {
    return "Just now"
  }

  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 1) {
    return "Just now"
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  if (days < 30) {
    return `${days}d ago`
  }

  return formatReportCapturedAt(date)
}
