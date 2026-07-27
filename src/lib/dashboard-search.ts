import {
  getReportStatusLabel,
  type WorkspaceReport,
} from "@/lib/reports"
import {
  getWorkspaceMemberRoleLabel,
  type WorkspaceTeamMember,
} from "@/lib/team-members"

type SearchParamsLike = {
  get: (name: string) => string | null
}

export function normalizeDashboardSearchQuery(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}

export function getDashboardSearchQuery(searchParams: SearchParamsLike) {
  return normalizeDashboardSearchQuery(searchParams.get("q"))
}

function matchesSearchFields(query: string, fields: Array<string | number | null | undefined>) {
  const normalizedQuery = normalizeDashboardSearchQuery(query)

  if (!normalizedQuery) {
    return true
  }

  const searchableText = fields
    .filter((field) => field !== null && field !== undefined)
    .map((field) => String(field).toLowerCase())
    .join(" ")

  return normalizedQuery
    .split(" ")
    .every((token) => searchableText.includes(token))
}

export function matchesWorkspaceReportSearch(
  report: WorkspaceReport,
  query: string
) {
  return matchesSearchFields(query, [
    report.id,
    report.title,
    report.summary,
    report.type,
    report.severity,
    report.status,
    getReportStatusLabel(report.status),
    report.domain,
    report.url,
    report.browser,
    report.device,
    report.viewport,
    report.capturedAt,
    report.capturedAgo,
    report.selectedElement?.tag,
    report.selectedElement?.selector,
    report.selectedElement?.text,
    ...Object.keys(report.selectedElement?.attributes ?? {}),
    ...Object.values(report.selectedElement?.attributes ?? {}),
    report.feedback.message,
    report.feedback.reporterName,
    report.feedback.reporterEmail,
    report.developerPrompt,
    report.assignee?.name,
    report.commentsCount,
  ])
}

export function matchesWorkspaceMemberSearch(
  member: WorkspaceTeamMember,
  query: string
) {
  return matchesSearchFields(query, [
    member.id,
    member.userId,
    member.name,
    member.displayName,
    member.email,
    member.role,
    getWorkspaceMemberRoleLabel(member.role),
    member.status,
    member.title,
    member.assignedCount,
    member.completedCount,
    member.reportsCount,
    member.joinedAtLabel,
  ])
}
