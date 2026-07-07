"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { useCallback, useEffect } from "react"

import { getJson, patchJson } from "@/lib/api-client"
import {
  reportKeys,
  type ReportCountFilters,
  type ReportListFilters,
} from "@/lib/query-keys"
import type {
  WorkspaceReport,
  WorkspaceReportCountsResponse,
  WorkspaceReportDetailResponse,
  WorkspaceReportsListResponse,
} from "@/lib/reports"

export type ReportMutationResponse = {
  report: WorkspaceReport
}

type CachedReportSnapshot = Array<[QueryKey, unknown]>
type ReportsInfiniteData = InfiniteData<WorkspaceReportsListResponse, string | null>
type ReportsListQueryKey =
  | ReturnType<typeof reportKeys.list>
  | ReturnType<typeof reportKeys.myWork>
type ReportMutationContext = {
  snapshots: CachedReportSnapshot
}

type AssignReportVariables = {
  assignee?: WorkspaceReport["assignee"]
  assigneeUserId: string | null
  report: WorkspaceReport
}

type UpdateReportStatusVariables = {
  note?: string
  report: WorkspaceReport
  status: WorkspaceReport["status"]
}

const refetchVisibleReportsIntervalMs = 15_000
const optimisticUnassignResetStatuses: WorkspaceReport["status"][] = [
  "assigned",
  "in_progress",
  "ready_for_review",
]

function getReportsListUrl({
  cursor,
  filters,
  workspaceSlug,
}: {
  cursor?: string | null
  filters: ReportListFilters
  workspaceSlug: string
}) {
  const searchParams = new URLSearchParams({
    limit: String(filters.limit ?? 30),
    sort: filters.sort ?? "newest",
    status: filters.status ?? "all",
  })

  if (cursor) {
    searchParams.set("cursor", cursor)
  }

  if (filters.q?.trim()) {
    searchParams.set("q", filters.q.trim())
  }

  if (filters.scope) {
    searchParams.set("scope", filters.scope)
  }

  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports?${searchParams}`
}

function getReportDetailUrl(workspaceSlug: string, reportId: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports/${encodeURIComponent(reportId)}`
}

function getReportCountsUrl({
  filters,
  workspaceSlug,
}: {
  filters: ReportCountFilters
  workspaceSlug: string
}) {
  const searchParams = new URLSearchParams()

  if (filters.q?.trim()) {
    searchParams.set("q", filters.q.trim())
  }

  if (filters.scope) {
    searchParams.set("scope", filters.scope)
  }

  const queryString = searchParams.toString()

  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports/counts${
    queryString ? `?${queryString}` : ""
  }`
}

export function getReportMutationBaseUrl(workspaceSlug: string, reportId: string) {
  return getReportDetailUrl(workspaceSlug, reportId)
}

export async function fetchReportsList({
  cursor,
  filters,
  workspaceSlug,
}: {
  cursor?: string | null
  filters: ReportListFilters
  workspaceSlug: string
}) {
  return getJson<WorkspaceReportsListResponse>(
    getReportsListUrl({ cursor, filters, workspaceSlug })
  )
}

export async function fetchReportDetail(workspaceSlug: string, reportId: string) {
  return getJson<WorkspaceReportDetailResponse>(
    getReportDetailUrl(workspaceSlug, reportId)
  )
}

export async function fetchReportCounts({
  filters,
  workspaceSlug,
}: {
  filters: ReportCountFilters
  workspaceSlug: string
}) {
  return getJson<WorkspaceReportCountsResponse>(
    getReportCountsUrl({ filters, workspaceSlug })
  )
}

export function makeInitialReportsInfiniteData(
  reports: WorkspaceReport[],
  pageInfo: WorkspaceReportsListResponse["pageInfo"]
): ReportsInfiniteData {
  return {
    pageParams: [null],
    pages: [
      {
        pageInfo,
        reports,
      },
    ],
  }
}

export function flattenReportPages(
  data: ReportsInfiniteData | undefined
) {
  if (!data) {
    return []
  }

  const reportsById = new Map<string, WorkspaceReport>()

  for (const page of data.pages) {
    for (const report of page.reports) {
      reportsById.set(report.id, report)
    }
  }

  return [...reportsById.values()]
}

function patchReportList(
  reports: WorkspaceReport[],
  nextReport: WorkspaceReport
) {
  return reports.map((report) =>
    report.id === nextReport.id ? mergeReportCacheEntry(report, nextReport) : report
  )
}

function getScreenshotEvidenceScore(report: WorkspaceReport) {
  return report.screenshots.reduce((score, screenshot) => {
    const hasSource = Boolean(screenshot.url || screenshot.thumbnailUrl)
    return score + (hasSource ? 2 : 1)
  }, 0)
}

export function mergeReportCacheEntry(
  currentReport: WorkspaceReport,
  nextReport: WorkspaceReport
) {
  const currentEvidenceScore = getScreenshotEvidenceScore(currentReport)
  const nextEvidenceScore = getScreenshotEvidenceScore(nextReport)

  return {
    ...currentReport,
    ...nextReport,
    screenshots:
      nextEvidenceScore >= currentEvidenceScore
        ? nextReport.screenshots
        : currentReport.screenshots,
  }
}

function isReportCacheEntry(value: unknown): value is WorkspaceReport {
  if (!value || typeof value !== "object" || !("id" in value)) {
    return false
  }

  return typeof value.id === "string"
}

function patchReportDetailCacheData<T>(data: T, nextReport: WorkspaceReport): T {
  if (!data || typeof data !== "object" || !("report" in data)) {
    return data
  }

  const currentReport = data.report

  if (!isReportCacheEntry(currentReport) || currentReport.id !== nextReport.id) {
    return data
  }

  return {
    ...data,
    report: mergeReportCacheEntry(currentReport, nextReport),
  } as T
}

function patchReportCollectionCacheData<T>(
  data: T,
  nextReport: WorkspaceReport
): T {
  if (!data || typeof data !== "object") {
    return data
  }

  if ("reports" in data && Array.isArray(data.reports)) {
    return {
      ...data,
      reports: patchReportList(data.reports, nextReport),
    } as T
  }

  if ("pages" in data && Array.isArray(data.pages)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        page && typeof page === "object" && "reports" in page
          ? {
              ...page,
              reports: Array.isArray(page.reports)
                ? patchReportList(page.reports, nextReport)
                : page.reports,
            }
          : page
      ),
    } as T
  }

  return data
}

function patchReportCacheData<T>(data: T, nextReport: WorkspaceReport): T {
  return patchReportCollectionCacheData(
    patchReportDetailCacheData(data, nextReport),
    nextReport
  )
}

export function syncReportAcrossCaches(
  queryClient: QueryClient,
  workspaceSlug: string,
  report: WorkspaceReport
) {
  queryClient.setQueriesData(
    { queryKey: reportKeys.all(workspaceSlug) },
    (currentData) => patchReportCacheData(currentData, report)
  )
}

function restoreReportSnapshots(
  queryClient: QueryClient,
  snapshots: CachedReportSnapshot | undefined
) {
  for (const [queryKey, data] of snapshots ?? []) {
    queryClient.setQueryData(queryKey, data)
  }
}

function getReportSnapshots(queryClient: QueryClient, workspaceSlug: string) {
  return queryClient.getQueriesData({
    queryKey: reportKeys.all(workspaceSlug),
  })
}

export function useReportsInfiniteQuery({
  filters,
  initialData,
  queryKind = "list",
  workspaceSlug,
}: {
  filters: ReportListFilters
  initialData?: InfiniteData<WorkspaceReportsListResponse, string | null>
  queryKind?: "list" | "my-work"
  workspaceSlug: string
}) {
  return useInfiniteQuery<
    WorkspaceReportsListResponse,
    Error,
    ReportsInfiniteData,
    ReportsListQueryKey,
    string | null
  >({
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
    initialData,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchReportsList({
        cursor: pageParam,
        filters,
        workspaceSlug,
      }),
    queryKey:
      queryKind === "my-work"
        ? reportKeys.myWork(workspaceSlug, filters)
        : reportKeys.list(workspaceSlug, filters),
    refetchInterval: refetchVisibleReportsIntervalMs,
    refetchIntervalInBackground: false,
  })
}

export function useReportCountsQuery({
  filters = {},
  workspaceSlug,
}: {
  filters?: ReportCountFilters
  workspaceSlug: string
}) {
  return useQuery({
    queryFn: () => fetchReportCounts({ filters, workspaceSlug }),
    queryKey: reportKeys.counts(workspaceSlug, filters),
    staleTime: 30 * 1000,
  })
}

export function useReportDetailQuery({
  enabled = true,
  placeholderReport,
  reportId,
  workspaceSlug,
}: {
  enabled?: boolean
  placeholderReport?: WorkspaceReport
  reportId?: string | null
  workspaceSlug: string
}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    enabled: enabled && Boolean(reportId),
    placeholderData: placeholderReport ? { report: placeholderReport } : undefined,
    queryFn: () => fetchReportDetail(workspaceSlug, reportId ?? ""),
    queryKey: reportId
      ? reportKeys.detail(workspaceSlug, reportId)
      : reportKeys.detail(workspaceSlug, "__none__"),
    refetchOnMount: "always",
    staleTime: 45 * 1000,
  })

  useEffect(() => {
    if (query.isPlaceholderData || !query.data?.report) {
      return
    }

    syncReportAcrossCaches(queryClient, workspaceSlug, query.data.report)
  }, [query.data, query.isPlaceholderData, queryClient, workspaceSlug])

  return query
}

export function usePrefetchReportDetail(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useCallback(
    (reportId: string) => {
      const queryKey = reportKeys.detail(workspaceSlug, reportId)

      void queryClient
        .prefetchQuery({
          queryFn: () => fetchReportDetail(workspaceSlug, reportId),
          queryKey,
          staleTime: 45 * 1000,
        })
        .then(() => {
          const detail =
            queryClient.getQueryData<WorkspaceReportDetailResponse>(queryKey)

          if (detail?.report) {
            syncReportAcrossCaches(queryClient, workspaceSlug, detail.report)
          }
        })
        .catch(() => {
          // Hover/focus prefetch is opportunistic; visible queries own errors.
        })
    },
    [queryClient, workspaceSlug]
  )
}

export function useAssignReportMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    ReportMutationResponse,
    Error,
    AssignReportVariables,
    ReportMutationContext
  >({
    mutationFn: ({ assigneeUserId, report }) =>
      patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/assignment`,
        { assigneeUserId }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ assignee, assigneeUserId, report }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        assignee,
        assigneeUserId,
        status: assigneeUserId
          ? "assigned"
          : optimisticUnassignResetStatuses.includes(report.status)
            ? "reviewing"
            : report.status,
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: reportKeys.countsRoot(workspaceSlug),
      })
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
    },
  })
}

export function useUpdateReportStatusMutation(workspaceSlug: string) {
  const queryClient = useQueryClient()

  return useMutation<
    ReportMutationResponse,
    Error,
    UpdateReportStatusVariables,
    ReportMutationContext
  >({
    mutationFn: ({ report, status }) =>
      patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/status`,
        { status }
      ),
    onError: (_error, _variables, context) => {
      restoreReportSnapshots(queryClient, context?.snapshots)
    },
    onMutate: async ({ report, status }) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.all(workspaceSlug) })

      const snapshots = getReportSnapshots(queryClient, workspaceSlug)
      const optimisticReport: WorkspaceReport = {
        ...report,
        status,
      }

      syncReportAcrossCaches(queryClient, workspaceSlug, optimisticReport)

      return { snapshots }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: reportKeys.countsRoot(workspaceSlug),
      })
    },
    onSuccess: (result) => {
      syncReportAcrossCaches(queryClient, workspaceSlug, result.report)
    },
  })
}
