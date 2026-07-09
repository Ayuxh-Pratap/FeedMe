"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  DashboardReportTableSkeleton,
} from "@/components/feedme/dashboard/dashboard-route-loading"
import {
  DashboardCenteredError,
  DashboardFreshnessNotice,
  DashboardInlineError,
} from "@/components/feedme/dashboard/dashboard-query-status"
import { ReportsEmptyState } from "@/components/feedme/dashboard/reports-empty-state"
import {
  ReportCard,
  ReportTableColumns,
  ReportTableRow,
} from "@/components/feedme/dashboard/reports-list"
import { useWorkspaceDashboardData } from "@/components/feedme/dashboard/workspace-dashboard-data"
import { replaceUrlSearchParams } from "@/lib/dashboard-url"
import {
  countUnseenReports,
  flattenReportPages,
  makeInitialReportsInfiniteData,
  usePrefetchReportDetail,
  useReportCountsQuery,
  useReportsFreshnessQuery,
  useReportsInfiniteQuery,
} from "@/lib/report-queries"
import type {
  WorkspaceReport,
  WorkspaceReportCounts,
  WorkspaceReportsPageInfo,
} from "@/lib/reports"
import { isAssignableReportRole, type WorkspaceMemberRole } from "@/lib/team-members"
import { cn } from "@/lib/utils"
import { useDashboardUiStore } from "@/stores/dashboard-ui-store"

type MyWorkPageProps = {
  pageInfo?: WorkspaceReportsPageInfo
  reports?: WorkspaceReport[]
  workspaceSlug: string
}

type MyWorkScope = "assigned" | "reported"
type ReportViewMode = "grid" | "table"
type SearchParamsLike = {
  get: (name: string) => string | null
}

const myWorkPageSize = 30
const emptyMyWorkPageInfo: WorkspaceReportsPageInfo = {
  hasNextPage: false,
  limit: myWorkPageSize,
  nextCursor: null,
}

const scopes: {
  label: string
  value: MyWorkScope
  emptyTitle: string
  emptyDescription: string
  match: (report: WorkspaceReport, currentUserId: string) => boolean
}[] = [
  {
    label: "Assigned to me",
    value: "assigned",
    emptyTitle: "No assigned reports yet",
    emptyDescription:
      "Reports assigned to you will appear here once an admin routes work to you.",
    match: (report, currentUserId) => report.assigneeUserId === currentUserId,
  },
  {
    label: "Reported by me",
    value: "reported",
    emptyTitle: "No submitted reports yet",
    emptyDescription:
      "Reports you submit from the dashboard or extension will appear here.",
    match: (report, currentUserId) => report.reporterUserId === currentUserId,
  },
]

function getDefaultScope(role: WorkspaceMemberRole): MyWorkScope {
  return isAssignableReportRole(role) ? "assigned" : "reported"
}

function getScopeParam(searchParams: SearchParamsLike): MyWorkScope | null {
  const scope = searchParams.get("scope")

  if (scope === "assigned" || scope === "reported") {
    return scope
  }

  return null
}

function getViewMode(searchParams: SearchParamsLike): ReportViewMode {
  return searchParams.get("view") === "grid" ? "grid" : "table"
}

function MyWorkPaginationFooter({
  hasNextPage,
  isLoadingMore,
  onLoadMore,
}: {
  hasNextPage: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}) {
  if (!hasNextPage) {
    return null
  }

  return (
    <div className="flex justify-center border-t border-border-hairline px-4 py-3">
      <button
        type="button"
        disabled={isLoadingMore}
        onClick={onLoadMore}
        className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-subtle disabled:hover:brightness-100 disabled:active:scale-100"
      >
        {isLoadingMore ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Load more reports
      </button>
    </div>
  )
}

function ScopeTabs({
  activeScope,
  counts,
  onScopeChange,
}: {
  activeScope: MyWorkScope
  counts?: Pick<WorkspaceReportCounts, "assignedToMe" | "reportedByMe">
  onScopeChange: (scope: MyWorkScope) => void
}) {
  return (
    <div className="relative grid w-full grid-cols-2 rounded-lg border border-border-hairline bg-background p-1 sm:w-[21rem]">
      <span
        className={cn(
          "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-surface-raised shadow-button-hover transition-transform duration-base ease-out-soft",
          activeScope === "reported" && "translate-x-[calc(100%+0.25rem)]"
        )}
        aria-hidden="true"
      />
      {scopes.map((scope) => {
        const active = activeScope === scope.value
        const count =
          scope.value === "assigned"
            ? counts?.assignedToMe
            : counts?.reportedByMe

        return (
          <button
            key={scope.value}
            type="button"
            onClick={() => onScopeChange(scope.value)}
            className={cn(
              "relative z-10 h-7 cursor-pointer rounded-md px-2 text-heading-5 transition-colors duration-base ease-out-soft active:scale-[var(--press-scale)]",
              active
                ? "text-foreground"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <span>{scope.label}</span>
            {count !== undefined ? (
              <span className="ml-1.5 text-caption text-text-muted">{count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function MyWorkPage({
  pageInfo = emptyMyWorkPageInfo,
  reports,
  workspaceSlug,
}: MyWorkPageProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewMode = getViewMode(searchParams)
  const {
    currentUserRole,
    dashboardSearchQuery,
    registerReports,
    setReportRailSelectedReportId,
  } = useWorkspaceDashboardData()
  const defaultScope = getDefaultScope(currentUserRole)
  const urlScope = getScopeParam(searchParams)
  const storedScope = useDashboardUiStore(
    (state) => state.lastMyWorkScopeByWorkspace[workspaceSlug]
  )
  const setLastMyWorkScope = useDashboardUiStore(
    (state) => state.setLastMyWorkScope
  )
  const initialScope = urlScope ?? storedScope ?? defaultScope
  const activeScope = urlScope ?? storedScope ?? defaultScope
  const searchQuery = dashboardSearchQuery
  const [initialSearchQuery] = useState(searchQuery)
  const filtersForQuery = useMemo(
    () => ({
      limit: myWorkPageSize,
      q: searchQuery,
      scope: activeScope,
    }),
    [activeScope, searchQuery]
  )
  const initialFilters = useMemo(
    () => ({
      limit: myWorkPageSize,
      q: initialSearchQuery,
      scope: initialScope,
    }),
    [initialScope, initialSearchQuery]
  )
  const shouldUseInitialData =
    Boolean(reports) &&
    filtersForQuery.q === initialFilters.q &&
    filtersForQuery.scope === initialFilters.scope
  const reportsQuery = useReportsInfiniteQuery({
    filters: filtersForQuery,
    initialData: shouldUseInitialData
      ? makeInitialReportsInfiniteData(reports ?? [], pageInfo)
      : undefined,
    queryKind: "my-work",
    workspaceSlug,
  })
  const countsQuery = useReportCountsQuery({
    filters: { q: searchQuery },
    workspaceSlug,
  })
  const prefetchReportDetail = usePrefetchReportDetail(workspaceSlug)
  const currentPageInfo =
    reportsQuery.data?.pages[reportsQuery.data.pages.length - 1]?.pageInfo ??
    pageInfo
  const reportRows = useMemo(
    () => flattenReportPages(reportsQuery.data),
    [reportsQuery.data]
  )
  const errorMessage =
    reportsQuery.error instanceof Error
      ? reportsQuery.error.message
      : reportsQuery.isError
        ? "Unable to load your work. Please try again."
        : null
  const isPending = reportsQuery.isPending
  const isLoadingMore = reportsQuery.isFetchingNextPage
  const activeScopeConfig =
    scopes.find((scope) => scope.value === activeScope) ?? scopes[0]
  const visibleReports = reportRows
  const showInitialSkeleton = isPending && visibleReports.length === 0
  const showInitialError =
    Boolean(errorMessage) && visibleReports.length === 0 && !showInitialSkeleton
  const showInlineError = Boolean(errorMessage) && visibleReports.length > 0
  const freshnessQuery = useReportsFreshnessQuery({
    enabled: !showInitialSkeleton && !showInitialError,
    filters: filtersForQuery,
    workspaceSlug,
  })
  const unseenReportCount = countUnseenReports({
    currentReports: visibleReports,
    incomingReports: freshnessQuery.data?.reports ?? [],
  })
  const requestedReportId = searchParams.get("report")
  const requestedSelectedReportId =
    requestedReportId && visibleReports.some((report) => report.id === requestedReportId)
      ? requestedReportId
      : null
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    requestedSelectedReportId
  )
  const localSelectedReportId =
    selectedReportId && visibleReports.some((report) => report.id === selectedReportId)
      ? selectedReportId
      : null
  const effectiveSelectedReportId =
    requestedSelectedReportId ?? localSelectedReportId ?? visibleReports[0]?.id ?? null

  const replaceSearchParams = useCallback((nextSearchParams: URLSearchParams) => {
    replaceUrlSearchParams(pathname, nextSearchParams)
  }, [pathname])

  const getCurrentSearchParams = useCallback(() => {
    return new URLSearchParams(searchParams.toString())
  }, [searchParams])

  function changeScope(scope: MyWorkScope) {
    const nextSearchParams = getCurrentSearchParams()

    setLastMyWorkScope(workspaceSlug, scope)
    setSelectedReportId(null)
    setReportRailSelectedReportId(null)

    if (scope === defaultScope) {
      nextSearchParams.delete("scope")
    } else {
      nextSearchParams.set("scope", scope)
    }

    nextSearchParams.delete("report")
    replaceSearchParams(nextSearchParams)
  }

  function selectReport(reportId: string) {
    setSelectedReportId(reportId)
    setReportRailSelectedReportId(reportId)

    const nextSearchParams = getCurrentSearchParams()
    nextSearchParams.set("report", reportId)
    replaceSearchParams(nextSearchParams)
  }

  function loadMoreReports() {
    if (!reportsQuery.hasNextPage || isLoadingMore) {
      return
    }

    void reportsQuery.fetchNextPage()
  }

  function retryReports() {
    void reportsQuery.refetch()
    void countsQuery.refetch()
  }

  function applyFreshReports() {
    retryReports()
  }

  useEffect(() => {
    const nextSelectedReportId = effectiveSelectedReportId ?? null

    registerReports({
      reports: visibleReports,
      selectedReportId: nextSelectedReportId,
      visibleReportIds: visibleReports.map((report) => report.id),
    })
  }, [
    effectiveSelectedReportId,
    registerReports,
    visibleReports,
  ])

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border-hairline px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-heading-3 text-foreground">My Work</h1>
            <p className="mt-1 text-body-3 text-text-body">
              Track the feedback assigned to you and the reports you submitted.
            </p>
          </div>

          <ScopeTabs
            activeScope={activeScope}
            counts={countsQuery.data?.counts}
            onScopeChange={changeScope}
          />
        </div>
      </header>

      {showInlineError && errorMessage ? (
        <DashboardInlineError
          isRetrying={reportsQuery.isRefetching}
          message={errorMessage}
          onRetry={retryReports}
        />
      ) : null}

      {!showInlineError ? (
        <DashboardFreshnessNotice
          count={unseenReportCount}
          isApplying={reportsQuery.isRefetching}
          onApply={applyFreshReports}
        />
      ) : null}

      {showInitialSkeleton ? <DashboardReportTableSkeleton /> : null}

      {showInitialError && errorMessage ? (
        <DashboardCenteredError
          isRetrying={reportsQuery.isFetching}
          message={errorMessage}
          onRetry={retryReports}
          title="Unable to load your work"
        />
      ) : null}

      {!showInitialSkeleton && !showInitialError && visibleReports.length === 0 ? (
        <div className="min-h-0 flex-1">
          <ReportsEmptyState
            description={
              searchQuery
                ? `Nothing matched "${searchQuery}" inside ${activeScopeConfig.label.toLowerCase()}.`
                : activeScopeConfig.emptyDescription
            }
            primaryActionHref={
              searchQuery
                ? `/${workspaceSlug}/reports?q=${encodeURIComponent(searchQuery)}`
                : `/${workspaceSlug}/reports`
            }
            primaryActionLabel={searchQuery ? "Search all reports" : "View all reports"}
            showSecondaryAction={false}
            title={
              searchQuery
                ? `No ${activeScopeConfig.label.toLowerCase()} matches`
                : activeScopeConfig.emptyTitle
            }
          />
        </div>
      ) : null}

      {!showInitialSkeleton && !showInitialError && visibleReports.length > 0 && viewMode === "table" ? (
        <div
          className="feedme-scrollbar min-h-0 flex-1 overflow-auto"
        >
          <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
            <caption className="sr-only">My work reports</caption>
            <ReportTableColumns />
            <thead className="sticky top-0 z-10 border-b border-border-hairline bg-background">
              <tr>
                <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                  Issue
                </th>
                <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                  Priority
                </th>
                <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                  Context
                </th>
                <th scope="col" className="px-4 py-3 text-caption font-medium text-text-muted">
                  Activity
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleReports.map((report) => (
                <ReportTableRow
                  key={report.id}
                  isSelected={report.id === effectiveSelectedReportId}
                  onSelect={() => selectReport(report.id)}
                  onWarmReport={() => prefetchReportDetail(report.id)}
                  report={report}
                />
              ))}
            </tbody>
          </table>
          <MyWorkPaginationFooter
            hasNextPage={currentPageInfo.hasNextPage}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreReports}
          />
        </div>
      ) : null}

      {!showInitialSkeleton && !showInitialError && visibleReports.length > 0 && viewMode === "grid" ? (
        <div
          className="feedme-scrollbar min-h-0 flex-1 overflow-auto p-4"
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,310px),1fr))] gap-3">
            {visibleReports.map((report) => (
              <ReportCard
                key={report.id}
                isSelected={report.id === effectiveSelectedReportId}
                onSelect={() => selectReport(report.id)}
                onWarmReport={() => prefetchReportDetail(report.id)}
                report={report}
              />
            ))}
          </div>
          <MyWorkPaginationFooter
            hasNextPage={currentPageInfo.hasNextPage}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreReports}
          />
        </div>
      ) : null}
    </section>
  )
}
