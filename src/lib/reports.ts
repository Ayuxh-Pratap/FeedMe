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
}

export type WorkspaceReport = {
  id: string
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
  }
  developerPrompt: string
  assignee?: {
    name: string
    initials: string
  }
  commentsCount: number
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
