"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { MockReportSummary } from "@/lib/mock/dashboard"
import { ReportCard, ReportTableRow } from "@/components/feedme/dashboard/reports-list"
import { cn } from "@/lib/utils"

type MyWorkPageProps = {
  reports: MockReportSummary[]
  workspaceSlug: string
}

type MyWorkScope = "assigned" | "reported"
type ReportViewMode = "grid" | "table"
type SearchParamsLike = {
  get: (name: string) => string | null
}

const assignedReportIds = new Set([
  "checkout-cta-overlap",
  "dashboard-search-focus",
  "mobile-nav-active-state",
  "team-invite-role-dropdown",
])

const reportedReportIds = new Set([
  "pricing-card-copy",
  "onboarding-upload-empty",
  "delete-project-warning",
  "domain-filter-empty-copy",
])

const scopes: {
  label: string
  value: MyWorkScope
  match: (report: MockReportSummary) => boolean
}[] = [
  {
    label: "Assigned to me",
    value: "assigned",
    match: (report) => assignedReportIds.has(report.id),
  },
  {
    label: "Reported by me",
    value: "reported",
    match: (report) => reportedReportIds.has(report.id),
  },
]

function getScope(searchParams: SearchParamsLike): MyWorkScope {
  return searchParams.get("scope") === "reported" ? "reported" : "assigned"
}

function getViewMode(searchParams: SearchParamsLike): ReportViewMode {
  return searchParams.get("view") === "grid" ? "grid" : "table"
}

function ScopeTabs({
  activeScope,
  onScopeChange,
  reports,
}: {
  activeScope: MyWorkScope
  onScopeChange: (scope: MyWorkScope) => void
  reports: MockReportSummary[]
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
        const count = reports.filter(scope.match).length

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

export function MyWorkPage({ reports, workspaceSlug }: MyWorkPageProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeScope = getScope(searchParams)
  const viewMode = getViewMode(searchParams)
  const activeScopeConfig =
    scopes.find((scope) => scope.value === activeScope) ?? scopes[0]
  const filteredReports = reports.filter(activeScopeConfig.match)
  const selectedReportId = searchParams.get("report") ?? filteredReports[0]?.id

  function replaceSearchParams(nextSearchParams: URLSearchParams) {
    const query = nextSearchParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function changeScope(scope: MyWorkScope) {
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    const nextScopeConfig = scopes.find((item) => item.value === scope) ?? scopes[0]
    const nextReports = reports.filter(nextScopeConfig.match)

    if (scope === "assigned") {
      nextSearchParams.delete("scope")
    } else {
      nextSearchParams.set("scope", scope)
    }

    if (nextReports[0]) {
      nextSearchParams.set("report", nextReports[0].id)
    } else {
      nextSearchParams.delete("report")
    }

    replaceSearchParams(nextSearchParams)
  }

  function selectReport(reportId: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.set("report", reportId)
    replaceSearchParams(nextSearchParams)
  }

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
            onScopeChange={changeScope}
            reports={reports}
          />
        </div>
      </header>

      {viewMode === "table" ? (
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
                  isSelected={report.id === selectedReportId}
                  onSelect={() => selectReport(report.id)}
                  report={report}
                  workspaceSlug={workspaceSlug}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="feedme-scrollbar min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,310px),1fr))] gap-3">
            {filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                isSelected={report.id === selectedReportId}
                onSelect={() => selectReport(report.id)}
                report={report}
                workspaceSlug={workspaceSlug}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
