"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ReportsEmptyState } from "@/components/feedme/dashboard/reports-empty-state"
import {
  ReportCard,
  ReportTableRow,
} from "@/components/feedme/dashboard/reports-list"
import { useWorkspaceDashboardData } from "@/components/feedme/dashboard/workspace-dashboard-data"
import { ApiClientError, getJson } from "@/lib/api-client"
import type {
  WorkspaceReport,
  WorkspaceReportsListResponse,
  WorkspaceReportsPageInfo,
} from "@/lib/reports"
import type { WorkspaceMemberRole } from "@/lib/team-members"
import { cn } from "@/lib/utils"

type MyWorkPageProps = {
  currentUserId: string
  currentUserRole: WorkspaceMemberRole
  pageInfo: WorkspaceReportsPageInfo
  reports: WorkspaceReport[]
  workspaceSlug: string
}

type MyWorkScope = "assigned" | "reported"
type ReportViewMode = "grid" | "table"
type SearchParamsLike = {
  get: (name: string) => string | null
}

const myWorkPageSize = 30

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
  return role === "developer" ? "assigned" : "reported"
}

function getScope(
  searchParams: SearchParamsLike,
  defaultScope: MyWorkScope
): MyWorkScope {
  const scope = searchParams.get("scope")

  if (scope === "assigned" || scope === "reported") {
    return scope
  }

  return defaultScope
}

function getViewMode(searchParams: SearchParamsLike): ReportViewMode {
  return searchParams.get("view") === "grid" ? "grid" : "table"
}

function mergeReportsById(
  currentReports: WorkspaceReport[],
  nextReports: WorkspaceReport[]
) {
  const reportsById = new Map<string, WorkspaceReport>()

  for (const report of currentReports) {
    reportsById.set(report.id, report)
  }

  for (const report of nextReports) {
    reportsById.set(report.id, report)
  }

  return [...reportsById.values()]
}

function getMyWorkReportsUrl({
  cursor,
  scope,
  searchQuery,
  workspaceSlug,
}: {
  cursor?: string | null
  scope: MyWorkScope
  searchQuery: string
  workspaceSlug: string
}) {
  const searchParams = new URLSearchParams({
    limit: String(myWorkPageSize),
    scope,
  })

  if (cursor) {
    searchParams.set("cursor", cursor)
  }

  if (searchQuery) {
    searchParams.set("q", searchQuery)
  }

  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports?${searchParams}`
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
  hasMoreReports,
  onScopeChange,
  reports,
  currentUserId,
}: {
  activeScope: MyWorkScope
  hasMoreReports: boolean
  onScopeChange: (scope: MyWorkScope) => void
  reports: WorkspaceReport[]
  currentUserId: string
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
        const count = active
          ? `${reports.filter((report) => scope.match(report, currentUserId)).length}${hasMoreReports ? "+" : ""}`
          : null

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
            {count !== null ? (
              <span className="ml-1.5 text-caption text-text-muted">{count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function MyWorkPage({
  currentUserId,
  currentUserRole,
  pageInfo,
  reports,
  workspaceSlug,
}: MyWorkPageProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultScope = getDefaultScope(currentUserRole)
  const initialScope = getScope(searchParams, defaultScope)
  const [activeScope, setActiveScope] = useState(initialScope)
  const viewMode = getViewMode(searchParams)
  const {
    dashboardSearchQuery,
    registerReports,
    reportRailReports,
    setReportRailSelectedReportId,
  } = useWorkspaceDashboardData()
  const searchQuery = dashboardSearchQuery
  const didMountRef = useRef(false)
  const isMountedRef = useRef(true)
  const requestSequenceRef = useRef(0)
  const [reportRows, setReportRows] = useState(reports)
  const [currentPageInfo, setCurrentPageInfo] = useState(pageInfo)
  const [isPending, setIsPending] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const activeScopeConfig =
    scopes.find((scope) => scope.value === activeScope) ?? scopes[0]
  const reportUpdatesById = useMemo(
    () =>
      new Map(reportRailReports.map((report) => [report.id, report])),
    [reportRailReports]
  )
  const visibleReports = useMemo(
    () =>
      reportRows.map((report) => reportUpdatesById.get(report.id) ?? report),
    [reportRows, reportUpdatesById]
  )
  const requestedReportId = searchParams.get("report")
  const initialSelectedReportId = visibleReports.some(
      (report) => report.id === requestedReportId
    )
      ? requestedReportId
      : visibleReports[0]?.id
  const [selectedReportId, setSelectedReportId] = useState(
    initialSelectedReportId
  )
  const effectiveSelectedReportId = visibleReports.some(
    (report) => report.id === selectedReportId
  )
    ? selectedReportId
    : visibleReports[0]?.id

  const replaceSearchParams = useCallback((nextSearchParams: URLSearchParams) => {
    if (!isMountedRef.current) {
      return
    }

    const query = nextSearchParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router])

  const getCurrentSearchParams = useCallback(() => {
    return new URLSearchParams(searchParams.toString())
  }, [searchParams])

  const loadReportsPage = useCallback(
    async ({ cursor = null }: { cursor?: string | null } = {}) => {
      const requestId = requestSequenceRef.current + 1
      const shouldAppend = Boolean(cursor)

      requestSequenceRef.current = requestId
      setErrorMessage(null)

      if (shouldAppend) {
        setIsLoadingMore(true)
      } else {
        setIsPending(true)
      }

      try {
        const result = await getJson<WorkspaceReportsListResponse>(
          getMyWorkReportsUrl({
            cursor,
            scope: activeScope,
            searchQuery,
            workspaceSlug,
          })
        )

        if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
          return
        }

        setCurrentPageInfo(result.pageInfo)
        setReportRows((currentReports) =>
          shouldAppend
            ? mergeReportsById(currentReports, result.reports)
            : result.reports
        )

        if (!shouldAppend) {
          const requestedId = searchParams.get("report")
          const nextSelectedReportId = result.reports.some(
            (report) => report.id === requestedId
          )
            ? requestedId
            : result.reports[0]?.id ?? null

          setSelectedReportId(nextSelectedReportId)
          setReportRailSelectedReportId(nextSelectedReportId)
        }
      } catch (error) {
        if (isMountedRef.current && requestSequenceRef.current === requestId) {
          setErrorMessage(
            error instanceof ApiClientError
              ? error.message
              : "Unable to load your work. Please try again."
          )
        }
      } finally {
        if (isMountedRef.current && requestSequenceRef.current === requestId) {
          if (shouldAppend) {
            setIsLoadingMore(false)
          } else {
            setIsPending(false)
          }
        }
      }
    },
    [
      activeScope,
      searchQuery,
      searchParams,
      setReportRailSelectedReportId,
      workspaceSlug,
    ]
  )

  function changeScope(scope: MyWorkScope) {
    const nextSearchParams = getCurrentSearchParams()

    setActiveScope(scope)
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
    if (!currentPageInfo.nextCursor || isLoadingMore) {
      return
    }

    void loadReportsPage({ cursor: currentPageInfo.nextCursor })
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      requestSequenceRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    void loadReportsPage()
  }, [loadReportsPage])

  useEffect(() => {
    const nextSelectedReportId = effectiveSelectedReportId ?? null

    registerReports({
      reports: visibleReports,
      selectedReportId: nextSelectedReportId,
      visibleReportIds: visibleReports.map((report) => report.id),
    })
    setReportRailSelectedReportId(nextSelectedReportId)
  }, [
    effectiveSelectedReportId,
    registerReports,
    setReportRailSelectedReportId,
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
            currentUserId={currentUserId}
            hasMoreReports={currentPageInfo.hasNextPage}
            onScopeChange={changeScope}
            reports={visibleReports}
          />
        </div>
      </header>

      {isPending ? (
        <div className="h-px shrink-0 overflow-hidden bg-fill-translucent">
          <div className="h-full w-full animate-pulse bg-primary-soft" />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="border-b border-border-hairline px-4 py-2 text-caption text-error">
          {errorMessage}
        </div>
      ) : null}

      {visibleReports.length === 0 ? (
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

      {visibleReports.length > 0 && viewMode === "table" ? (
        <div
          className={cn(
            "feedme-scrollbar min-h-0 flex-1 overflow-auto transition-opacity duration-base ease-out-soft",
            isPending && "opacity-60"
          )}
        >
          <table className="w-full min-w-[900px] border-collapse text-left">
            <caption className="sr-only">My work reports</caption>
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
                  report={report}
                  workspaceSlug={workspaceSlug}
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

      {visibleReports.length > 0 && viewMode === "grid" ? (
        <div
          className={cn(
            "feedme-scrollbar min-h-0 flex-1 overflow-auto p-4 transition-opacity duration-base ease-out-soft",
            isPending && "opacity-60"
          )}
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,310px),1fr))] gap-3">
            {visibleReports.map((report) => (
              <ReportCard
                key={report.id}
                isSelected={report.id === effectiveSelectedReportId}
                onSelect={() => selectReport(report.id)}
                report={report}
                workspaceSlug={workspaceSlug}
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
