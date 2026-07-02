"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { ReportsEmptyState } from "@/components/feedme/dashboard/reports-empty-state"
import { ReportCard, ReportTableRow } from "@/components/feedme/dashboard/reports-list"
import { useWorkspaceDashboardData } from "@/components/feedme/dashboard/workspace-dashboard-data"
import {
  matchesWorkspaceReportSearch,
} from "@/lib/dashboard-search"
import type { WorkspaceReport } from "@/lib/reports"
import type { WorkspaceMemberRole } from "@/lib/team-members"
import { cn } from "@/lib/utils"

type MyWorkPageProps = {
  currentUserId: string
  currentUserRole: WorkspaceMemberRole
  reports: WorkspaceReport[]
  workspaceSlug: string
}

type MyWorkScope = "assigned" | "reported"
type ReportViewMode = "grid" | "table"
type SearchParamsLike = {
  get: (name: string) => string | null
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

function ScopeTabs({
  activeScope,
  onScopeChange,
  reports,
  currentUserId,
}: {
  activeScope: MyWorkScope
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
        const count = reports.filter((report) => scope.match(report, currentUserId)).length

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
            <span className="ml-1.5 text-caption text-text-muted">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

export function MyWorkPage({
  currentUserId,
  currentUserRole,
  reports,
  workspaceSlug,
}: MyWorkPageProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const defaultScope = getDefaultScope(currentUserRole)
  const initialScope = getScope(searchParams, defaultScope)
  const [activeScope, setActiveScope] = useState(initialScope)
  const viewMode = getViewMode(searchParams)
  const {
    dashboardSearchQuery,
    registerReports,
    setReportRailSelectedReportId,
  } = useWorkspaceDashboardData()
  const searchQuery = dashboardSearchQuery
  const activeScopeConfig =
    scopes.find((scope) => scope.value === activeScope) ?? scopes[0]
  const searchScopedReports = useMemo(
    () =>
      reports.filter((report) =>
        matchesWorkspaceReportSearch(report, searchQuery)
      ),
    [reports, searchQuery]
  )
  const filteredReports = useMemo(
    () =>
      searchScopedReports.filter((report) =>
        activeScopeConfig.match(report, currentUserId)
      ),
    [activeScopeConfig, currentUserId, searchScopedReports]
  )
  const requestedReportId = searchParams.get("report")
  const initialSelectedReportId = filteredReports.some(
      (report) => report.id === requestedReportId
    )
      ? requestedReportId
      : filteredReports[0]?.id
  const [selectedReportId, setSelectedReportId] = useState(
    initialSelectedReportId
  )
  const effectiveSelectedReportId = filteredReports.some(
    (report) => report.id === selectedReportId
  )
    ? selectedReportId
    : filteredReports[0]?.id

  function replaceSearchParams(nextSearchParams: URLSearchParams) {
    const query = nextSearchParams.toString()
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname)
  }

  function getCurrentSearchParams() {
    return new URLSearchParams(window.location.search)
  }

  function changeScope(scope: MyWorkScope) {
    const nextSearchParams = getCurrentSearchParams()
    const nextScopeConfig = scopes.find((item) => item.value === scope) ?? scopes[0]
    const nextReports = searchScopedReports.filter((report) =>
      nextScopeConfig.match(report, currentUserId)
    )
    const nextSelectedReportId = nextReports[0]?.id

    setActiveScope(scope)
    setSelectedReportId(nextSelectedReportId)
    setReportRailSelectedReportId(nextSelectedReportId ?? null)

    if (scope === defaultScope) {
      nextSearchParams.delete("scope")
    } else {
      nextSearchParams.set("scope", scope)
    }

    if (nextSelectedReportId) {
      nextSearchParams.set("report", nextSelectedReportId)
    } else {
      nextSearchParams.delete("report")
    }

    replaceSearchParams(nextSearchParams)
  }

  function selectReport(reportId: string) {
    setSelectedReportId(reportId)
    setReportRailSelectedReportId(reportId)

    const nextSearchParams = getCurrentSearchParams()
    nextSearchParams.set("report", reportId)
    replaceSearchParams(nextSearchParams)
  }

  useEffect(() => {
    const nextSelectedReportId = effectiveSelectedReportId ?? null

    registerReports({
      reports,
      selectedReportId: nextSelectedReportId,
      visibleReportIds: filteredReports.map((report) => report.id),
    })
    setReportRailSelectedReportId(nextSelectedReportId)
  }, [
    effectiveSelectedReportId,
    filteredReports,
    registerReports,
    reports,
    setReportRailSelectedReportId,
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
            onScopeChange={changeScope}
            reports={searchScopedReports}
          />
        </div>
      </header>

      {filteredReports.length === 0 ? (
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

      {filteredReports.length > 0 && viewMode === "table" ? (
        <div className="feedme-scrollbar min-h-0 flex-1 overflow-auto">
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
              {filteredReports.map((report) => (
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
        </div>
      ) : null}

      {filteredReports.length > 0 && viewMode === "grid" ? (
        <div className="feedme-scrollbar min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,310px),1fr))] gap-3">
            {filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                isSelected={report.id === effectiveSelectedReportId}
                onSelect={() => selectReport(report.id)}
                report={report}
                workspaceSlug={workspaceSlug}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
