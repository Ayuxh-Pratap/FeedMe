"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, type KeyboardEvent, type ReactNode } from "react"
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe2,
} from "lucide-react"

import {
  reportPriorityCodeBaseClass,
  reportPriorityCodePillStyle,
  reportSeverityPriorityLabels,
} from "@/components/feedme/dashboard/report-badge-styles"
import {
  isInProgressWorkspaceReport,
  isOpenWorkspaceReport,
  type WorkspaceReport,
} from "@/lib/reports"
import { cn } from "@/lib/utils"

type ReportsListProps = {
  reports: WorkspaceReport[]
  workspaceSlug: string
}

type ReportViewMode = "grid" | "table"
type StatusFilter = "all" | "open" | "in_progress" | "resolved"
type ReportSort = "newest" | "oldest" | "priority" | "comments"
type SearchParamsLike = {
  get: (name: string) => string | null
}

const filters: {
  label: string
  value: StatusFilter
  match: (report: WorkspaceReport) => boolean
}[] = [
  { label: "All", value: "all", match: () => true },
  { label: "Open", value: "open", match: isOpenWorkspaceReport },
  {
    label: "In progress",
    value: "in_progress",
    match: isInProgressWorkspaceReport,
  },
  { label: "Closed", value: "resolved", match: (report) => report.status === "resolved" },
]

const sortOptions: {
  label: string
  value: ReportSort
}[] = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Priority", value: "priority" },
  { label: "Most comments", value: "comments" },
]

const severitySortRank: Record<WorkspaceReport["severity"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function getViewMode(searchParams: SearchParamsLike): ReportViewMode {
  return searchParams.get("view") === "grid" ? "grid" : "table"
}

function getStatusFilter(searchParams: SearchParamsLike): StatusFilter {
  const value = searchParams.get("status")

  if (value === "open" || value === "in_progress" || value === "resolved") {
    return value
  }

  return "all"
}

function getReportSort(searchParams: SearchParamsLike): ReportSort {
  const value = searchParams.get("sort")

  if (value === "oldest" || value === "priority" || value === "comments") {
    return value
  }

  return "newest"
}

function getCapturedTimestamp(report: WorkspaceReport) {
  const timestamp = Date.parse(report.capturedAtIso ?? report.capturedAt)

  return Number.isNaN(timestamp) ? 0 : timestamp
}

function sortReports(reports: WorkspaceReport[], sort: ReportSort) {
  return [...reports].sort((first, second) => {
    const newestFirst =
      getCapturedTimestamp(second) - getCapturedTimestamp(first)

    if (sort === "oldest") {
      return getCapturedTimestamp(first) - getCapturedTimestamp(second)
    }

    if (sort === "priority") {
      return (
        severitySortRank[first.severity] -
          severitySortRank[second.severity] || newestFirst
      )
    }

    if (sort === "comments") {
      return second.commentsCount - first.commentsCount || newestFirst
    }

    return newestFirst
  })
}

function getSortLabel(sort: ReportSort) {
  return sortOptions.find((option) => option.value === sort)?.label ?? "Newest first"
}

function ReportPriorityCode({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <span
      title={title}
      className={cn(
        reportPriorityCodeBaseClass,
        reportPriorityCodePillStyle
      )}
    >
      {children}
    </span>
  )
}

function ReportEvidenceImage({ report }: { report: WorkspaceReport }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-surface-card">
      {report.id === "checkout-cta-overlap" ? (
        <div className="absolute inset-0 grid grid-cols-[1.05fr_0.95fr]">
          <div className="relative border-r border-border-hairline bg-background">
            <div className="absolute left-[18%] top-[18%] h-3 w-28 rounded bg-fill-subtle" />
            <div className="absolute left-[18%] top-[34%] h-8 w-44 rounded-md border border-border-hairline bg-fill-translucent" />
            <div className="absolute left-[18%] top-[50%] h-8 w-44 rounded-md border border-primary-soft/40 bg-primary/20 shadow-[0_0_24px_color-mix(in_srgb,var(--primary-soft)_45%,transparent)]" />
            <div className="absolute bottom-[14%] left-[18%] h-6 w-28 rounded-md [background:var(--gradient-primary-premium)]" />
          </div>
          <div className="relative bg-surface-panel">
            <div className="absolute inset-0 opacity-70 [background:repeating-linear-gradient(90deg,transparent_0_18px,color-mix(in_srgb,var(--primary-soft)_22%,transparent)_19px_20px)]" />
            <div className="absolute right-[18%] top-[28%] h-3 w-24 rounded bg-fill-subtle" />
            <div className="absolute right-[18%] top-[44%] h-8 w-32 rounded-md border border-border-hairline bg-surface-card" />
            <div className="absolute bottom-[20%] right-[18%] h-5 w-28 rounded-md bg-surface-raised" />
          </div>
        </div>
      ) : report.id === "pricing-card-copy" ? (
        <div className="absolute inset-0 grid grid-cols-[1.65fr_1fr]">
          <div className="relative bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--primary-soft)_55%,transparent),transparent_42%),linear-gradient(145deg,color-mix(in_srgb,var(--surface-panel)_78%,var(--primary-soft)_22%),var(--surface-shell))]">
            <div className="absolute left-5 top-6 h-4 w-24 rounded bg-fill-subtle" />
            <div className="absolute left-5 top-12 h-3 w-32 rounded bg-fill-translucent" />
            <div className="absolute bottom-6 left-5 h-4 w-28 rounded bg-fill-subtle" />
          </div>
          <div className="relative bg-surface-raised">
            <div className="absolute left-7 top-8 h-4 w-24 rounded bg-background/70" />
            <div className="absolute left-7 top-16 h-6 w-36 rounded-md border border-border-hairline bg-background" />
            <div className="absolute left-7 top-28 h-6 w-36 rounded-md [background:var(--gradient-primary-premium)]" />
            <div className="absolute bottom-6 left-7 h-3 w-24 rounded bg-background/70" />
          </div>
        </div>
      ) : report.id === "dashboard-search-focus" ? (
        <div className="absolute inset-0 grid grid-cols-[1.55fr_1fr] bg-background">
          <div className="relative border-r border-primary-soft/25">
            <div className="absolute left-0 top-0 h-full w-14 border-r border-border-hairline bg-card" />
            <div className="absolute left-20 right-4 top-5 h-7 rounded-lg border border-border-hairline bg-fill-translucent" />
            <div className="absolute left-28 top-20 h-10 w-44 rounded-lg border border-border-hairline bg-fill-subtle" />
            <div className="absolute bottom-7 left-28 right-10 h-12 rounded-lg border border-primary-soft/30 bg-fill-translucent shadow-[0_0_26px_color-mix(in_srgb,var(--primary-soft)_30%,transparent)]" />
          </div>
          <div className="relative bg-surface-card">
            <div className="absolute left-7 top-10 h-3 w-24 rounded bg-fill-subtle" />
            <div className="absolute left-7 top-20 h-7 w-36 rounded-md border border-border-hairline bg-fill-translucent" />
            <div className="absolute bottom-10 right-7 h-8 w-28 rounded-lg border border-border-hairline bg-fill-subtle" />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 grid grid-cols-[1.55fr_1fr]">
          <div className="relative bg-card">
            <div className="absolute left-[24%] top-[26%] h-4 w-36 rounded bg-fill-subtle" />
            <div className="absolute left-[24%] top-[45%] h-8 w-44 rounded-md border border-border-hairline bg-fill-translucent" />
            <div className="absolute bottom-[20%] left-[24%] h-7 w-44 rounded-md border border-border-subtle bg-surface-raised" />
          </div>
          <div className="relative bg-[linear-gradient(90deg,var(--surface-panel),var(--surface-shell))]">
            <div className="absolute inset-y-0 left-8 w-px bg-primary-soft/30" />
            <div className="absolute bottom-8 right-8 h-10 w-28 rounded-lg border border-border-hairline bg-fill-subtle" />
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-[radial-gradient(360px_170px_at_24%_72%,color-mix(in_srgb,var(--primary-soft)_16%,transparent),transparent_70%)]" />
    </div>
  )
}

function ReportsHeader({
  activeFilter,
  onFilterChange,
  onSortChange,
  reports,
  sort,
}: {
  activeFilter: StatusFilter
  onFilterChange: (filter: StatusFilter) => void
  onSortChange: (sort: ReportSort) => void
  reports: WorkspaceReport[]
  sort: ReportSort
}) {
  return (
    <header className="shrink-0 border-b border-border-hairline px-4 py-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-heading-3 text-foreground">Reports</h1>
          <p className="mt-1 text-body-3 text-text-body">
            Captured feedback queued for triage and developer handoff.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border-hairline bg-fill-translucent p-1">
            {filters.map((filter) => {
              const count = reports.filter(filter.match).length
              const active = activeFilter === filter.value

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => onFilterChange(filter.value)}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-heading-5 transition-all duration-base ease-out-soft active:scale-[var(--press-scale)]",
                    active
                      ? "bg-surface-raised text-foreground shadow-button-hover"
                      : "text-text-body hover:bg-fill-subtle hover:text-foreground"
                  )}
                >
                  {filter.label}
                  <span className="text-caption text-text-muted">{count}</span>
                </button>
              )
            })}
          </div>

          <ReportSortDropdown sort={sort} onSortChange={onSortChange} />
        </div>
      </div>

    </header>
  )
}

function ReportSortDropdown({
  onSortChange,
  sort,
}: {
  onSortChange: (sort: ReportSort) => void
  sort: ReportSort
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget

        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-hairline bg-fill-translucent px-3 text-heading-5 text-text-body shadow-button-secondary outline-none transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover focus:border-border-strong active:scale-[var(--press-scale)]"
      >
        {getSortLabel(sort)}
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-base ease-out-soft",
            open && "rotate-180 text-text-secondary"
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Sort reports"
          className="absolute right-0 top-[calc(100%+0.375rem)] z-30 w-44 overflow-hidden rounded-lg border border-border-subtle bg-surface-card p-1 text-foreground shadow-popover"
        >
          {sortOptions.map((option) => {
            const selected = sort === option.value

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onSortChange(option.value)
                  setOpen(false)
                }}
                className={cn(
                  "flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2.5 text-left text-body-3 transition-colors duration-base ease-out-soft",
                  selected
                    ? "bg-surface-raised text-foreground shadow-button-hover"
                    : "text-text-body hover:bg-fill-subtle hover:text-foreground"
                )}
              >
                {option.label}
                {selected ? <Check className="size-3.5 text-text-secondary" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function ReportCard({
  isSelected,
  onSelect,
  report,
  workspaceSlug,
}: {
  isSelected: boolean
  onSelect: () => void
  report: WorkspaceReport
  workspaceSlug: string
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "group relative aspect-[16/9] cursor-pointer overflow-hidden rounded-xl border bg-surface-card outline-none transition-all duration-base ease-out-soft",
        "hover:-translate-y-0.5 hover:border-border-subtle hover:shadow-popover focus-visible:border-border-strong",
        isSelected
          ? "border-primary-soft/75 shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary-soft)_12%,transparent),0_18px_54px_color-mix(in_srgb,var(--surface-divider)_72%,transparent)] hover:border-primary-soft/80 focus-visible:border-primary-soft/80"
          : "border-border-hairline shadow-card"
      )}
    >
      <ReportEvidenceImage report={report} />

      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        <ReportPriorityCode title={`${report.severity} priority`}>
          {reportSeverityPriorityLabels[report.severity]}
        </ReportPriorityCode>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,color-mix(in_srgb,var(--surface-divider)_92%,transparent),color-mix(in_srgb,var(--surface-divider)_46%,transparent)_58%,transparent)]" />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 pr-12">
        <h2
          className={cn(
            "line-clamp-1 text-heading-5 text-foreground transition-transform duration-base ease-out-soft"
          )}
        >
          {report.title}
        </h2>

        <div
          className={cn(
            "flex max-h-0 min-w-0 translate-y-1 flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden text-body-3 text-text-secondary opacity-0 transition-all duration-slow ease-toolbar",
            "group-hover:max-h-5 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:max-h-5 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
            isSelected && "max-h-5 translate-y-0 opacity-100"
          )}
        >
          <span>{report.assignee?.name ?? "Unassigned"}</span>
          <span className="text-text-muted">{report.domain}</span>
          <span className="text-text-muted">{report.capturedAgo}</span>
        </div>
      </div>

      <Link
        href={`/${workspaceSlug}/reports/${report.id}`}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "absolute bottom-3 right-3 inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-foreground shadow-button-hover transition-all duration-base ease-out-soft",
          "hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
        )}
        aria-label={`Open ${report.title}`}
      >
        <ArrowUpRight className="size-3.5" />
      </Link>
    </article>
  )
}

export function ReportTableRow({
  isSelected,
  onSelect,
  report,
  workspaceSlug,
}: {
  isSelected: boolean
  onSelect: () => void
  report: WorkspaceReport
  workspaceSlug: string
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        "group cursor-pointer border-b border-border-hairline outline-none transition-all duration-base ease-out-soft",
        "hover:bg-fill-translucent focus-visible:bg-fill-subtle",
        isSelected && "bg-fill-subtle"
      )}
    >
      <td className="w-[46%] px-4 py-4 align-top">
        <div className="min-w-0">
          <p className="truncate text-heading-5 text-foreground">
            {report.title}
          </p>
          <p className="mt-1 line-clamp-1 text-body-3 text-text-body">
            {report.summary}
          </p>
        </div>
      </td>
      <td className="w-28 px-4 py-4 align-top">
        <ReportPriorityCode title={`${report.severity} priority`}>
          {reportSeverityPriorityLabels[report.severity]}
        </ReportPriorityCode>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex min-w-0 items-center gap-2 text-body-3 text-text-secondary">
          <Globe2 className="size-3.5 shrink-0 text-text-muted" />
          <span className="truncate">{report.domain}</span>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="flex items-center justify-between gap-3 text-body-3 text-text-body">
          <span className="inline-flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full border border-border-hairline bg-fill-subtle text-caption text-foreground">
              {report.assignee?.initials ?? "U"}
            </span>
            {report.assignee?.name ?? "Unassigned"}
          </span>
          <span className="text-text-muted">{report.capturedAgo}</span>
          <Link
            href={`/${workspaceSlug}/reports/${report.id}`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border-hairline bg-fill-translucent text-text-body transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
            aria-label={`Open ${report.title}`}
          >
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </td>
    </tr>
  )
}

export function ReportsList({ reports, workspaceSlug }: ReportsListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewMode = getViewMode(searchParams)
  const statusFilter = getStatusFilter(searchParams)
  const sort = getReportSort(searchParams)
  const activeFilter = filters.find((filter) => filter.value === statusFilter) ?? filters[0]
  const filteredReports = sortReports(reports.filter(activeFilter.match), sort)
  const selectedReportId = searchParams.get("report") ?? filteredReports[0]?.id ?? reports[0]?.id

  function replaceSearchParams(nextSearchParams: URLSearchParams) {
    const query = nextSearchParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function selectReport(reportId: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.set("report", reportId)
    replaceSearchParams(nextSearchParams)
  }

  function changeFilter(filter: StatusFilter) {
    const nextSearchParams = new URLSearchParams(searchParams.toString())
    const nextFilter = filters.find((item) => item.value === filter) ?? filters[0]
    const nextReports = sortReports(reports.filter(nextFilter.match), sort)

    if (filter === "all") {
      nextSearchParams.delete("status")
    } else {
      nextSearchParams.set("status", filter)
    }

    if (nextReports[0]) {
      nextSearchParams.set("report", nextReports[0].id)
    } else {
      nextSearchParams.delete("report")
    }

    replaceSearchParams(nextSearchParams)
  }

  function changeSort(nextSort: ReportSort) {
    const nextSearchParams = new URLSearchParams(searchParams.toString())

    if (nextSort === "newest") {
      nextSearchParams.delete("sort")
    } else {
      nextSearchParams.set("sort", nextSort)
    }

    replaceSearchParams(nextSearchParams)
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ReportsHeader
        activeFilter={statusFilter}
        onFilterChange={changeFilter}
        onSortChange={changeSort}
        reports={reports}
        sort={sort}
      />

      {viewMode === "table" ? (
        <div className="feedme-scrollbar min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <caption className="sr-only">Feedback reports</caption>
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
