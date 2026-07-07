"use client"

import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe2,
  Loader2,
} from "lucide-react"

import {
  DashboardReportTableSkeleton,
} from "@/components/feedme/dashboard/dashboard-route-loading"
import {
  DashboardCenteredError,
  DashboardFreshnessNotice,
  DashboardInlineError,
} from "@/components/feedme/dashboard/dashboard-query-status"
import {
  reportPriorityCodeBaseClass,
  reportPriorityCodePillStyle,
  reportSeverityPriorityLabels,
} from "@/components/feedme/dashboard/report-badge-styles"
import { FeedMeAvatar } from "@/components/feedme/dashboard/feedme-avatar"
import {
  isInProgressWorkspaceReport,
  isOpenWorkspaceReport,
  type WorkspaceReport,
  type WorkspaceReportCounts,
  type WorkspaceReportSort,
  type WorkspaceReportsPageInfo,
} from "@/lib/reports"
import { cn } from "@/lib/utils"
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

type ReportsListProps = {
  pageInfo?: WorkspaceReportsPageInfo
  reports?: WorkspaceReport[]
  workspaceSlug: string
}

type ReportViewMode = "grid" | "table"
type StatusFilter = "all" | "open" | "in_progress" | "resolved"
type ReportSort = WorkspaceReportSort
type SearchParamsLike = {
  get: (name: string) => string | null
}

const filters: {
  countKey: keyof Pick<WorkspaceReportCounts, "all" | "open" | "inProgress" | "resolved">
  label: string
  value: StatusFilter
  match: (report: WorkspaceReport) => boolean
}[] = [
  { countKey: "all", label: "All", value: "all", match: () => true },
  { countKey: "open", label: "Open", value: "open", match: isOpenWorkspaceReport },
  {
    countKey: "inProgress",
    label: "In progress",
    value: "in_progress",
    match: isInProgressWorkspaceReport,
  },
  {
    countKey: "resolved",
    label: "Closed",
    value: "resolved",
    match: (report) => report.status === "resolved",
  },
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

const reportsPageSize = 30
const emptyReportsPageInfo: WorkspaceReportsPageInfo = {
  hasNextPage: false,
  limit: reportsPageSize,
  nextCursor: null,
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

function ReportAssigneeAvatar({ report }: { report: WorkspaceReport }) {
  if (!report.assignee) {
    return (
      <span className="flex size-6 items-center justify-center rounded-full border border-border-hairline bg-fill-subtle text-caption text-text-muted">
        U
      </span>
    )
  }

  return (
    <FeedMeAvatar
      className="shadow-none"
      displayValue={report.assignee.initials}
      imageUrl={report.assignee.avatarUrl}
      label={report.assignee.name}
      size={24}
      value={report.assignee.name}
    />
  )
}

function ReportEvidenceImage({ report }: { report: WorkspaceReport }) {
  const [loaded, setLoaded] = useState(false)
  const screenshot = report.screenshots.find((item) => item.url) ?? report.screenshots[0]
  // Grid cards are small; prefer the optimized Cloudinary thumbnail over the
  // full-resolution screenshot to keep the gallery light.
  const source = screenshot?.thumbnailUrl ?? screenshot?.url

  if (screenshot && source) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-surface-card">
        <Image
          src={source}
          alt={`${screenshot.label} screenshot evidence`}
          fill
          unoptimized
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
          onLoad={() => setLoaded(true)}
          className={cn(
            "object-cover transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
        <div className="absolute inset-0 bg-[radial-gradient(360px_170px_at_24%_72%,color-mix(in_srgb,var(--primary-soft)_14%,transparent),transparent_70%)]" />
      </div>
    )
  }

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
  counts,
  onFilterChange,
  onSortChange,
  sort,
}: {
  activeFilter: StatusFilter
  counts?: WorkspaceReportCounts
  onFilterChange: (filter: StatusFilter) => void
  onSortChange: (sort: ReportSort) => void
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
              const active = activeFilter === filter.value
              const count = counts?.[filter.countKey]

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
                  {count !== undefined ? (
                    <span className="text-caption text-text-muted">{count}</span>
                  ) : null}
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

function ReportsNoMatches({
  activeFilterLabel,
  searchQuery,
}: {
  activeFilterLabel: string
  searchQuery: string
}) {
  const hasSearch = Boolean(searchQuery)

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-10">
      <div className="mx-auto max-w-[360px] text-center">
        <h2 className="text-heading-3 text-foreground">
          {hasSearch ? "No matching reports" : "No reports in this view"}
        </h2>
        <p className="mt-2 text-body-2 text-text-body">
          {hasSearch
            ? `Nothing matched "${searchQuery}" inside ${activeFilterLabel.toLowerCase()} reports.`
            : "Try a different status filter to see more captured feedback."}
        </p>
      </div>
    </div>
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

function ReportsPaginationFooter({
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

export function ReportCard({
  isSelected,
  onSelect,
  onWarmReport,
  report,
}: {
  isSelected: boolean
  onSelect: () => void
  onWarmReport?: () => void
  report: WorkspaceReport
}) {
  function selectWithWarmCache() {
    onWarmReport?.()
    onSelect()
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={selectWithWarmCache}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          selectWithWarmCache()
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

      <a
        href={report.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          event.stopPropagation()
        }}
        className={cn(
          "absolute bottom-3 right-3 inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-foreground shadow-button-hover transition-all duration-base ease-out-soft",
          "hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
        )}
        aria-label={`Open captured page for ${report.title}`}
      >
        <ArrowUpRight className="size-3.5" />
      </a>
    </article>
  )
}

export function ReportTableRow({
  isSelected,
  onSelect,
  onWarmReport,
  report,
}: {
  isSelected: boolean
  onSelect: () => void
  onWarmReport?: () => void
  report: WorkspaceReport
}) {
  function selectWithWarmCache() {
    onWarmReport?.()
    onSelect()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      selectWithWarmCache()
    }
  }

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={selectWithWarmCache}
      onKeyDown={handleKeyDown}
      className={cn(
        "group cursor-pointer border-b border-border-hairline outline-none transition-all duration-base ease-out-soft",
        "hover:bg-fill-translucent focus-visible:bg-fill-subtle",
        isSelected && "bg-fill-subtle"
      )}
    >
      <td className="max-w-0 px-4 py-4 align-top">
        <div className="min-w-0 max-w-full">
          <p
            className="max-w-full truncate text-heading-5 text-foreground"
            title={report.title}
          >
            {report.title}
          </p>
          <p
            className="mt-1 max-w-full truncate text-body-3 text-text-body"
            title={report.summary}
          >
            {report.summary}
          </p>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <ReportPriorityCode title={`${report.severity} priority`}>
          {reportSeverityPriorityLabels[report.severity]}
        </ReportPriorityCode>
      </td>
      <td className="max-w-0 px-4 py-4 align-top">
        <div className="flex min-w-0 items-center gap-2 text-body-3 text-text-secondary">
          <Globe2 className="size-3.5 shrink-0 text-text-muted" />
          <span className="truncate">{report.domain}</span>
        </div>
      </td>
      <td className="max-w-0 px-4 py-4 align-top">
        <div className="flex min-w-0 items-center justify-between gap-3 text-body-3 text-text-body">
          <span className="inline-flex min-w-0 items-center gap-2">
            <ReportAssigneeAvatar report={report} />
            <span className="truncate">{report.assignee?.name ?? "Unassigned"}</span>
          </span>
          <span className="shrink-0 text-text-muted">{report.capturedAgo}</span>
          <a
            href={report.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              event.stopPropagation()
            }}
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-hairline bg-fill-translucent text-text-body transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
            aria-label={`Open captured page for ${report.title}`}
          >
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </td>
    </tr>
  )
}

export function ReportTableColumns() {
  return (
    <colgroup>
      <col className="w-[46%]" />
      <col className="w-28" />
      <col className="w-[22%]" />
      <col className="w-[24%]" />
    </colgroup>
  )
}

export function ReportsList({
  pageInfo = emptyReportsPageInfo,
  reports,
  workspaceSlug,
}: ReportsListProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewMode = getViewMode(searchParams)
  const initialStatusFilter = getStatusFilter(searchParams)
  const initialSort = getReportSort(searchParams)
  const {
    dashboardSearchQuery,
    registerReports,
    reportRailReports,
    setReportRailSelectedReportId,
  } = useWorkspaceDashboardData()
  const searchQuery = dashboardSearchQuery
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter)
  const [sort, setSort] = useState(initialSort)
  const [initialSearchQuery] = useState(searchQuery)
  const filtersForQuery = useMemo(
    () => ({
      limit: reportsPageSize,
      q: searchQuery,
      sort,
      status: statusFilter,
    }),
    [searchQuery, sort, statusFilter]
  )
  const initialFilters = useMemo(
    () => ({
      limit: reportsPageSize,
      q: initialSearchQuery,
      sort: initialSort,
      status: initialStatusFilter,
    }),
    [initialSearchQuery, initialSort, initialStatusFilter]
  )
  const shouldUseInitialData =
    Boolean(reports) &&
    filtersForQuery.q === initialFilters.q &&
    filtersForQuery.sort === initialFilters.sort &&
    filtersForQuery.status === initialFilters.status
  const reportsQuery = useReportsInfiniteQuery({
    filters: filtersForQuery,
    initialData: shouldUseInitialData
      ? makeInitialReportsInfiniteData(reports ?? [], pageInfo)
      : undefined,
    workspaceSlug,
  })
  const countsQuery = useReportCountsQuery({
    filters: { q: searchQuery },
    workspaceSlug,
  })
  const prefetchReportDetail = usePrefetchReportDetail(workspaceSlug)
  const activeFilter = filters.find((filter) => filter.value === statusFilter) ?? filters[0]
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
        ? "Unable to load reports. Please try again."
        : null
  const isPending = reportsQuery.isPending
  const isLoadingMore = reportsQuery.isFetchingNextPage
  const reportUpdatesById = useMemo(
    () => new Map(reportRailReports.map((report) => [report.id, report])),
    [reportRailReports]
  )
  const visibleReports = useMemo(
    () =>
      reportRows.map((report) => reportUpdatesById.get(report.id) ?? report),
    [reportRows, reportUpdatesById]
  )
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

  function selectReport(reportId: string) {
    setSelectedReportId(reportId)
    setReportRailSelectedReportId(reportId)

    const nextSearchParams = getCurrentSearchParams()
    nextSearchParams.set("report", reportId)
    replaceSearchParams(nextSearchParams)
  }

  function changeFilter(filter: StatusFilter) {
    const nextSearchParams = getCurrentSearchParams()

    setStatusFilter(filter)
    setSelectedReportId(null)
    setReportRailSelectedReportId(null)

    if (filter === "all") {
      nextSearchParams.delete("status")
    } else {
      nextSearchParams.set("status", filter)
    }

    nextSearchParams.delete("report")
    replaceSearchParams(nextSearchParams)
  }

  function changeSort(nextSort: ReportSort) {
    setSort(nextSort)

    const nextSearchParams = getCurrentSearchParams()

    if (nextSort === "newest") {
      nextSearchParams.delete("sort")
    } else {
      nextSearchParams.set("sort", nextSort)
    }

    nextSearchParams.delete("report")
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
      <ReportsHeader
        activeFilter={statusFilter}
        counts={countsQuery.data?.counts}
        onFilterChange={changeFilter}
        onSortChange={changeSort}
        sort={sort}
      />

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
          title="Unable to load reports"
        />
      ) : null}

      {!showInitialSkeleton && !showInitialError && visibleReports.length === 0 ? (
        <ReportsNoMatches
          activeFilterLabel={activeFilter.label}
          searchQuery={searchQuery}
        />
      ) : null}

      {!showInitialSkeleton && !showInitialError && visibleReports.length > 0 && viewMode === "table" ? (
        <div
          className="feedme-scrollbar min-h-0 flex-1 overflow-auto"
        >
          <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
            <caption className="sr-only">Feedback reports</caption>
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
          <ReportsPaginationFooter
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
          <ReportsPaginationFooter
            hasNextPage={currentPageInfo.hasNextPage}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreReports}
          />
        </div>
      ) : null}
    </section>
  )
}
