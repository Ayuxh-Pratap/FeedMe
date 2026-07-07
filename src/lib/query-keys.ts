import type {
  WorkspaceReportScope,
  WorkspaceReportSort,
  WorkspaceReportStatusFilter,
} from "@/lib/reports"

export type ReportListFilters = {
  limit?: number
  q?: string
  scope?: WorkspaceReportScope
  sort?: WorkspaceReportSort
  status?: WorkspaceReportStatusFilter
}

export type ReportCountFilters = {
  q?: string
  scope?: WorkspaceReportScope
}

function normalizeText(value?: string) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function normalizeReportListFilters(filters: ReportListFilters) {
  return {
    limit: filters.limit ?? 30,
    q: normalizeText(filters.q),
    scope: filters.scope,
    sort: filters.sort ?? "newest",
    status: filters.status ?? "all",
  } satisfies Required<Pick<ReportListFilters, "limit" | "sort" | "status">> &
    Pick<ReportListFilters, "q" | "scope">
}

export function normalizeReportCountFilters(filters: ReportCountFilters = {}) {
  return {
    q: normalizeText(filters.q),
    scope: filters.scope,
  } satisfies ReportCountFilters
}

export const workspaceKeys = {
  all: ["workspace"] as const,
  bySlug: (slug: string) => [...workspaceKeys.all, slug] as const,
  domains: (slug: string) => [...workspaceKeys.bySlug(slug), "domains"] as const,
  invites: (slug: string) => [...workspaceKeys.bySlug(slug), "invites"] as const,
  members: (slug: string) => [...workspaceKeys.bySlug(slug), "members"] as const,
  tokens: (slug: string) => [...workspaceKeys.bySlug(slug), "tokens"] as const,
}

export const reportKeys = {
  all: (slug: string) => [...workspaceKeys.bySlug(slug), "reports"] as const,
  countsRoot: (slug: string) =>
    [...reportKeys.all(slug), "counts"] as const,
  counts: (slug: string, filters: ReportCountFilters = {}) =>
    [...reportKeys.countsRoot(slug), normalizeReportCountFilters(filters)] as const,
  detail: (slug: string, reportId: string) =>
    [...reportKeys.all(slug), "detail", reportId] as const,
  list: (slug: string, filters: ReportListFilters) =>
    [...reportKeys.all(slug), "list", normalizeReportListFilters(filters)] as const,
  myWork: (slug: string, filters: ReportListFilters) =>
    [...reportKeys.all(slug), "my-work", normalizeReportListFilters(filters)] as const,
}
