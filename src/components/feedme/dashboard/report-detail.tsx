"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  CheckCircle2,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  Monitor,
  MousePointer2,
  Play,
  Plus,
  Send,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react"

import { FeedMeAvatar } from "@/components/feedme/dashboard/feedme-avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  reportBadgeBaseClass,
  reportNeutralPillStyle,
  reportSeverityPillStyles,
  reportStatusPillStyles,
} from "@/components/feedme/dashboard/report-badge-styles"
import {
  getReportStatusLabel,
  isWorkspaceReportAssignmentLocked,
  type WorkspaceReport,
  type WorkspaceReportStatus,
} from "@/lib/reports"
import {
  isAssignableReportRole,
  type WorkspaceMemberRole,
  type WorkspaceTeamMember,
} from "@/lib/team-members"
import { ApiClientError } from "@/lib/api-client"
import {
  mergeReportCacheEntry,
  useAssignReportMutation,
  useReportDetailQuery,
  useUpdateReportImplementationBriefMutation,
  useUpdateReportStatusMutation,
} from "@/lib/report-queries"
import { replaceUrlSearchParams } from "@/lib/dashboard-url"
import { cn } from "@/lib/utils"

type ReportDetailProps = {
  currentUserId: string
  currentUserRole: WorkspaceMemberRole
  members: WorkspaceTeamMember[]
  report: WorkspaceReport
  workspaceSlug: string
}

type ReportScreenshot = WorkspaceReport["screenshots"][number]
type ReportDetailTab = "evidence" | "activity" | "brief"
type ReferenceLinkDraft = {
  id: string
  label: string
  url: string
}

function DetailBadge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        reportBadgeBaseClass,
        className
      )}
    >
      {children}
    </span>
  )
}

function getScreenshotDimensions(
  report: WorkspaceReport,
  screenshot: ReportScreenshot
) {
  if (screenshot.width && screenshot.height) {
    return {
      width: screenshot.width,
      height: screenshot.height,
    }
  }

  const match = report.viewport.match(/(\d+)\s*x\s*(\d+)/i)
  const width = match ? Number(match[1]) : 1440
  const height = match ? Number(match[2]) : 900

  if (screenshot.kind === "page") {
    return { width, height }
  }

  return {
    width: Math.max(320, Math.round(width * 0.42)),
    height: Math.max(220, Math.round(height * 0.34)),
  }
}

function ScreenshotEvidence({
  className,
  screenshot,
  preferThumbnail,
}: {
  className?: string
  screenshot: ReportScreenshot
  preferThumbnail?: boolean
}) {
  // Inline evidence cards prefer the optimized thumbnail; the fullscreen viewer
  // requests the full-resolution original.
  const source = preferThumbnail ? screenshot.thumbnailUrl ?? screenshot.url : screenshot.url

  if (source) {
    return (
      <div className={cn("relative overflow-hidden bg-surface-card", className)}>
        <Image
          src={source}
          alt={`${screenshot.label} screenshot evidence`}
          fill
          unoptimized
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-contain"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(0deg,color-mix(in_srgb,var(--surface-divider)_78%,transparent),transparent)]" />
        <p className="pointer-events-none absolute bottom-3 left-3 truncate text-caption text-text-secondary">
          {screenshot.label}
        </p>
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden bg-surface-card", className)}>
      <div className="absolute inset-0 [background:linear-gradient(145deg,var(--surface-raised),var(--surface-shell))]" />
      <div className="absolute left-4 right-4 top-4 h-6 rounded-lg border border-border-hairline bg-background/70" />
      <div className="absolute left-4 top-14 h-20 w-28 rounded-lg border border-border-hairline bg-fill-subtle" />
      <div className="absolute bottom-5 left-4 right-4 h-16 rounded-lg border border-border-hairline bg-background/70" />
      {screenshot.kind === "annotated" ? (
        <>
          <div className="absolute bottom-12 left-12 right-10 h-px bg-primary-soft shadow-[0_0_20px_color-mix(in_srgb,var(--primary-soft)_80%,transparent)]" />
          <div className="absolute bottom-10 right-10 size-5 rounded-full border border-primary-soft bg-primary-soft/20 shadow-[0_0_22px_color-mix(in_srgb,var(--primary-soft)_70%,transparent)]" />
        </>
      ) : null}
    </div>
  )
}

function ScreenshotViewer({
  activeIndex,
  onActiveIndexChange,
  onOpenChange,
  open,
  report,
}: {
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  report: WorkspaceReport
}) {
  const total = report.screenshots.length
  const selectedIndex = Math.min(Math.max(activeIndex, 0), total - 1)
  const selectedScreenshot = report.screenshots[selectedIndex] ?? report.screenshots[0]
  const dimensions = selectedScreenshot
    ? getScreenshotDimensions(report, selectedScreenshot)
    : { width: 0, height: 0 }

  function move(direction: -1 | 1) {
    const nextIndex = (selectedIndex + direction + total) % total
    onActiveIndexChange(nextIndex)
  }

  if (!selectedScreenshot) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[min(100vw-2rem,980px)] gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:!max-w-[min(100vw-2rem,980px)]"
      >
        <div className="relative h-[min(78vh,720px)] min-h-[360px] overflow-hidden bg-surface-card">
          {report.screenshots.map((screenshot, index) => (
            <ScreenshotEvidence
              key={screenshot.id}
              screenshot={screenshot}
              className={cn(
                "absolute inset-0 transition-all duration-slow ease-toolbar",
                index === selectedIndex
                  ? "scale-100 opacity-100"
                  : "pointer-events-none scale-[0.985] opacity-0"
              )}
            />
          ))}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-divider)_86%,transparent),color-mix(in_srgb,var(--surface-divider)_42%,transparent)_52%,transparent)]" />

          <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-heading-5 text-foreground">
                {selectedScreenshot.label} evidence
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-caption text-text-secondary">
                {selectedIndex + 1} of {total} / {dimensions.width} x{" "}
                {dimensions.height} / {report.capturedAt}
              </DialogDescription>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous screenshot"
                onClick={() => move(-1)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-background/70 text-text-secondary shadow-button-secondary backdrop-blur-md transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next screenshot"
                onClick={() => move(1)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-background/70 text-text-secondary shadow-button-secondary backdrop-blur-md transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Close screenshot viewer"
                onClick={() => onOpenChange(false)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border-hairline bg-background/70 text-text-secondary shadow-button-secondary backdrop-blur-md transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScreenshotPanel({
  isEvidenceHydrating = false,
  report,
}: {
  isEvidenceHydrating?: boolean
  report: WorkspaceReport
}) {
  const [viewerIndex, setViewerIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  return (
    <section className="rounded-xl border border-border-hairline bg-fill-translucent">
      <div className="flex h-10 items-center justify-between border-b border-border-hairline px-4">
        <div className="flex items-center gap-2 text-heading-5 text-foreground">
          <Monitor className="size-4 text-text-muted" />
          Screenshot evidence
        </div>
        <p className="text-caption text-text-muted">Page + annotation</p>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-2">
        {report.screenshots.map((screenshot, index) => (
          <div
            key={screenshot.id}
            className="overflow-hidden rounded-lg border border-border-hairline bg-background"
          >
            <div className="flex h-8 items-center justify-between border-b border-border-hairline px-3">
              <p className="text-heading-5 text-foreground">{screenshot.label}</p>
              <p className="text-caption text-text-muted">{index + 1} of 2</p>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden bg-surface-card">
              <ScreenshotEvidence screenshot={screenshot} preferThumbnail className="absolute inset-0" />
              <button
                type="button"
                aria-label={`Open ${screenshot.label} screenshot`}
                onClick={() => {
                  setViewerIndex(index)
                  setIsViewerOpen(true)
                }}
                className="absolute bottom-3 right-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
              >
                <Maximize2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {isEvidenceHydrating && report.screenshots.length < 2 ? (
          <div className="overflow-hidden rounded-lg border border-border-hairline bg-background">
            <div className="flex h-8 items-center justify-between border-b border-border-hairline px-3">
              <p className="text-heading-5 text-foreground">Element</p>
              <p className="text-caption text-text-muted">Fetching</p>
            </div>
            <div className="relative flex aspect-[16/10] flex-col items-center justify-center gap-2 overflow-hidden bg-surface-card px-6 text-center">
              <Loader2 className="size-4 animate-spin text-primary-soft" />
              <p className="text-heading-5 text-foreground">
                Loading screenshot evidence
              </p>
              <p className="max-w-56 text-caption text-text-muted">
                Fetching the full report screenshots.
              </p>
            </div>
          </div>
        ) : null}
      </div>
      <ScreenshotViewer
        activeIndex={viewerIndex}
        onActiveIndexChange={setViewerIndex}
        onOpenChange={setIsViewerOpen}
        open={isViewerOpen}
        report={report}
      />
    </section>
  )
}

function MetadataItem({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2">
      <p className="text-caption text-text-muted">{label}</p>
      <div className="mt-1 truncate text-body-3 text-text-secondary">{value}</div>
    </div>
  )
}

const unassignedSelectValue = "__unassigned__"

function getMutationErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

function ReportWorkflowPanel({
  currentUserId,
  currentUserRole,
  members,
  report,
  workspaceSlug,
}: ReportDetailProps) {
  const [selectedAssigneeUserId, setSelectedAssigneeUserId] = useState(
    report.assigneeUserId ?? unassignedSelectValue
  )
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false)
  const [mutation, setMutation] = useState<"assignment" | "status" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const assignReportMutation = useAssignReportMutation(workspaceSlug)
  const updateStatusMutation = useUpdateReportStatusMutation(workspaceSlug)

  const assignableMembers = members.filter(
    (member) => isAssignableReportRole(member.role) && member.status === "active"
  )
  const selectedAssignee = assignableMembers.find(
    (member) => member.userId === selectedAssigneeUserId
  )
  const canManageReport =
    currentUserRole === "owner" || currentUserRole === "admin"
  const isAssignedImplementationMember =
    isAssignableReportRole(currentUserRole) && report.assigneeUserId === currentUserId
  const selectedAssigneeLabel =
    selectedAssigneeUserId === unassignedSelectValue
      ? "Unassigned"
      : selectedAssignee?.name ?? report.assignee?.name ?? "Unknown teammate"
  const assignmentLocked = isWorkspaceReportAssignmentLocked(report.status)
  const hasAssignmentChange =
    selectedAssigneeUserId !== (report.assigneeUserId ?? unassignedSelectValue)
  const canStartWork = isAssignedImplementationMember && report.status === "assigned"
  const canMarkReady =
    isAssignedImplementationMember &&
    (report.status === "assigned" || report.status === "in_progress")
  const canResolve =
    canManageReport &&
    report.status !== "resolved" &&
    report.status !== "archived"
  const shouldShowPanel = canManageReport || isAssignedImplementationMember

  if (!shouldShowPanel) {
    return null
  }

  async function updateAssignment() {
    setMutation("assignment")
    setError(null)
    const nextAssigneeUserId =
      selectedAssigneeUserId === unassignedSelectValue
        ? null
        : selectedAssigneeUserId
    const nextAssignee = selectedAssignee
      ? {
          avatarUrl: selectedAssignee.avatarUrl,
          initials: selectedAssignee.initials,
          name: selectedAssignee.name,
        }
      : undefined

    try {
      const result = await assignReportMutation.mutateAsync({
        assignee: nextAssignee,
        assigneeUserId: nextAssigneeUserId,
        report,
      })
      setSelectedAssigneeUserId(
        result.report.assigneeUserId ?? unassignedSelectValue
      )
    } catch (updateError) {
      setError(getMutationErrorMessage(updateError))
    } finally {
      setMutation(null)
    }
  }

  async function updateStatus(status: WorkspaceReportStatus) {
    setMutation("status")
    setError(null)

    try {
      await updateStatusMutation.mutateAsync({ report, status })
    } catch (updateError) {
      setError(getMutationErrorMessage(updateError))
    } finally {
      setMutation(null)
    }
  }

  const isMutating = mutation !== null
  const secondaryActionClass =
    "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border-subtle disabled:hover:brightness-100 disabled:active:scale-100"

  return (
    <section className="overflow-visible rounded-xl border border-border-hairline bg-fill-translucent">
      <div className="flex flex-col gap-3 border-b border-border-hairline px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-heading-5 text-foreground">
            <UserRoundCheck className="size-4 text-text-muted" />
            Workflow
          </div>
          {!assignmentLocked ? (
            <p className="mt-1 text-body-3 text-text-body">
              Assign this report to a developer or designer and move it through review.
            </p>
          ) : null}
        </div>

        <DetailBadge className={reportStatusPillStyles[report.status]}>
          {getReportStatusLabel(report.status)}
        </DetailBadge>
      </div>

      <div className="p-3">
        {canManageReport ? (
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div
              className="relative"
              onBlur={(event) => {
                const nextTarget = event.relatedTarget

                if (
                  !(nextTarget instanceof Node) ||
                  !event.currentTarget.contains(nextTarget)
                ) {
                  setAssigneeMenuOpen(false)
                }
              }}
            >
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={assigneeMenuOpen}
                disabled={assignmentLocked || mutation === "assignment"}
                onClick={() => setAssigneeMenuOpen((value) => !value)}
                className={cn(
                  "flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-left text-body-3 text-text-secondary shadow-button-secondary outline-none transition-all duration-base ease-out-soft",
                  "hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover focus:border-border-strong active:scale-[var(--press-scale)]",
                  (assignmentLocked || mutation === "assignment") &&
                    "cursor-not-allowed opacity-50 hover:bg-fill-translucent hover:text-text-secondary hover:shadow-button-secondary active:scale-100"
                )}
              >
                <span className="min-w-0 truncate">
                  {selectedAssigneeLabel}
                </span>
                {assignmentLocked ? (
                  <Lock className="size-3.5 shrink-0 text-text-muted" />
                ) : (
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 transition-transform duration-base ease-out-soft",
                      assigneeMenuOpen && "rotate-180 text-text-secondary"
                    )}
                  />
                )}
              </button>

              {assigneeMenuOpen && !assignmentLocked ? (
                <div
                  role="listbox"
                  aria-label="Assign report"
                  className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-30 overflow-hidden rounded-lg border border-border-subtle bg-surface-card p-1 text-foreground shadow-popover"
                >
                  {[
                    {
                      email: null,
                      label: "Unassigned",
                      value: unassignedSelectValue,
                    },
                    ...assignableMembers.map((member) => ({
                      email: member.email,
                      label: member.name,
                      value: member.userId,
                    })),
                  ].map((option) => {
                    const selected = selectedAssigneeUserId === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setSelectedAssigneeUserId(option.value)
                          setAssigneeMenuOpen(false)
                          setError(null)
                        }}
                        className={cn(
                          "flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-body-3 transition-colors duration-base ease-out-soft",
                          selected
                            ? "bg-surface-raised text-foreground shadow-button-hover"
                            : "text-text-body hover:bg-fill-subtle hover:text-foreground"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{option.label}</span>
                          {option.email ? (
                            <span className="block truncate text-caption text-text-muted">
                              {option.email}
                            </span>
                          ) : null}
                        </span>
                        {selected ? (
                          <Check className="size-3.5 shrink-0 text-text-secondary" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
            {!assignmentLocked ? (
              <button
                type="button"
                disabled={!hasAssignmentChange || mutation === "assignment"}
                onClick={updateAssignment}
                className={secondaryActionClass}
              >
                {mutation === "assignment" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Save assignment
              </button>
            ) : null}
            {canResolve ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => updateStatus("resolved")}
                className={secondaryActionClass}
              >
                {mutation === "status" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Resolve
              </button>
            ) : null}
          </div>
        ) : null}

        {!assignmentLocked && assignableMembers.length === 0 && canManageReport ? (
          <p className="mt-2 text-caption text-text-muted">
            Invite an active developer or designer before assigning work.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {isAssignedImplementationMember ? (
            <>
              <button
                type="button"
                disabled={!canStartWork || isMutating}
                onClick={() => updateStatus("in_progress")}
                className={secondaryActionClass}
              >
                {mutation === "status" && canStartWork ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                Start work
              </button>
              <button
                type="button"
                disabled={!canMarkReady || isMutating}
                onClick={() => updateStatus("ready_for_review")}
                className={secondaryActionClass}
              >
                {mutation === "status" && canMarkReady ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Ready for review
              </button>
            </>
          ) : null}

          {!canManageReport && canResolve ? (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => updateStatus("resolved")}
              className={secondaryActionClass}
            >
              {mutation === "status" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Resolve
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-caption text-error">{error}</p>
        ) : null}
      </div>
    </section>
  )
}

function getAllowedReportDetailTab(
  tab: string | null,
  canManageReport: boolean
): ReportDetailTab {
  if (tab === "activity") {
    return "activity"
  }

  if (tab === "brief" && canManageReport) {
    return "brief"
  }

  return "evidence"
}

function getDetailTabSearchParams(
  searchParams: { toString: () => string },
  tab: ReportDetailTab
) {
  const params = new URLSearchParams(searchParams.toString())

  if (tab === "evidence") {
    params.delete("tab")
  } else {
    params.set("tab", tab)
  }

  return params
}

function makeDraftId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

function makeReferenceLinkDraft(
  link?: NonNullable<WorkspaceReport["implementationBrief"]>["referenceLinks"][number]
): ReferenceLinkDraft {
  return {
    id: makeDraftId(),
    label: link?.label ?? "",
    url: link?.url ?? "",
  }
}

function normalizeBriefList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean)
}

function normalizeReferenceLinks(links: ReferenceLinkDraft[]) {
  return links
    .map((link) => ({
      label: link.label.trim() || undefined,
      url: link.url.trim(),
    }))
    .filter((link) => Boolean(link.url))
}

function BriefTextarea({
  label,
  onChange,
  placeholder,
  rows = 6,
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  value: string
}) {
  return (
    <label className="grid gap-2 border-b border-border-hairline px-4 py-4 last:border-b-0">
      <span className="text-heading-5 text-foreground">{label}</span>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="feedme-scrollbar h-40 min-h-40 resize-y rounded-lg border border-border-hairline bg-background px-3 py-2 text-body-3 text-text-secondary outline-none transition-all duration-base ease-out-soft placeholder:text-text-muted focus:border-border-strong focus:bg-surface-card"
      />
    </label>
  )
}

function BriefListEditor({
  addLabel,
  items,
  label,
  onChange,
  placeholder,
}: {
  addLabel: string
  items: string[]
  label: string
  onChange: (items: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState("")

  function addItem() {
    const value = draft.trim()

    if (!value) {
      return
    }

    onChange([...items, value])
    setDraft("")
  }

  function updateItem(index: number, value: string) {
    const nextItems = [...items]
    nextItems[index] = value
    onChange(nextItems)
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <section className="border-b border-border-hairline px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-text-muted" />
          <h3 className="text-heading-5 text-foreground">{label}</h3>
          {items.length > 0 ? (
            <span className="rounded-full border border-border-hairline bg-fill-translucent px-2 py-0.5 text-caption text-text-muted">
              {items.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={addItem}
          className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-border-hairline bg-fill-translucent px-2 text-caption text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-fill-translucent disabled:hover:text-text-body disabled:active:scale-100"
        >
          <Plus className="size-3.5" />
          {addLabel}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border-hairline bg-fill-translucent text-caption text-text-muted">
              {index + 1}
            </span>
            <input
              value={item}
              onChange={(event) => updateItem(index, event.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border border-border-hairline bg-background px-3 text-body-3 text-text-secondary outline-none transition-all duration-base ease-out-soft placeholder:text-text-muted focus:border-border-strong focus:bg-surface-card"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-hairline bg-fill-translucent text-text-muted shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
              aria-label={`Remove ${label.toLowerCase()} item ${index + 1}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        <div>
          <input
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addItem()
              }
            }}
            className="h-11 w-full rounded-lg border border-border-hairline bg-background px-3 text-body-3 text-text-secondary outline-none transition-all duration-base ease-out-soft placeholder:text-text-muted focus:border-border-strong focus:bg-surface-card"
          />
        </div>
      </div>
    </section>
  )
}

function ReferenceLinksEditor({
  links,
  onChange,
}: {
  links: ReferenceLinkDraft[]
  onChange: (links: ReferenceLinkDraft[]) => void
}) {
  function addLink() {
    onChange([...links, makeReferenceLinkDraft()])
  }

  function updateLink(
    id: string,
    field: keyof Pick<ReferenceLinkDraft, "label" | "url">,
    value: string
  ) {
    onChange(
      links.map((link) => (link.id === id ? { ...link, [field]: value } : link))
    )
  }

  function removeLink(id: string) {
    onChange(links.filter((link) => link.id !== id))
  }

  return (
    <section className="border-b border-border-hairline px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-text-muted" />
          <h3 className="text-heading-5 text-foreground">Reference links</h3>
        </div>
        <button
          type="button"
          onClick={addLink}
          className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-border-hairline bg-fill-translucent px-2 text-caption text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover active:scale-[var(--press-scale)]"
        >
          <Plus className="size-3.5" />
          Add
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {links.length === 0 ? (
          <div className="flex h-11 items-center rounded-lg border border-dashed border-border-hairline bg-background px-3 text-body-3 text-text-muted">
            No reference links
          </div>
        ) : null}

        {links.map((link) => (
          <div key={link.id} className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]">
            <input
              value={link.label}
              placeholder="Label"
              onChange={(event) => updateLink(link.id, "label", event.target.value)}
              className="h-11 rounded-lg border border-border-hairline bg-background px-3 text-body-3 text-text-secondary outline-none transition-all duration-base ease-out-soft placeholder:text-text-muted focus:border-border-strong focus:bg-surface-card"
            />
            <input
              value={link.url}
              placeholder="https://"
              onChange={(event) => updateLink(link.id, "url", event.target.value)}
              className="h-11 rounded-lg border border-border-hairline bg-background px-3 text-body-3 text-text-secondary outline-none transition-all duration-base ease-out-soft placeholder:text-text-muted focus:border-border-strong focus:bg-surface-card"
            />
            <button
              type="button"
              onClick={() => removeLink(link.id)}
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border-hairline bg-fill-translucent text-text-muted shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
              aria-label="Remove reference link"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImplementationBriefEditor({
  report,
  workspaceSlug,
}: {
  report: WorkspaceReport
  workspaceSlug: string
}) {
  const brief = report.implementationBrief
  const hiddenAcceptanceCriteria = brief?.acceptanceCriteria ?? []
  const hiddenConstraintsNonGoals = brief?.constraintsNonGoals ?? []
  const [implementationNotes, setImplementationNotes] = useState(
    () => brief?.implementationNotes ?? ""
  )
  const [expectedBehavior, setExpectedBehavior] = useState(
    () => brief?.expectedBehavior ?? ""
  )
  const [referenceLinks, setReferenceLinks] = useState(() =>
    (brief?.referenceLinks ?? []).map((link) => makeReferenceLinkDraft(link))
  )
  const [reviewChecklist, setReviewChecklist] = useState(() =>
    brief?.reviewChecklist ?? []
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const updateBriefMutation =
    useUpdateReportImplementationBriefMutation(workspaceSlug)

  async function saveBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaved(false)

    try {
      await updateBriefMutation.mutateAsync({
        report,
        implementationBrief: {
          acceptanceCriteria: normalizeBriefList(hiddenAcceptanceCriteria),
          implementationNotes: implementationNotes.trim() || null,
          constraintsNonGoals: normalizeBriefList(hiddenConstraintsNonGoals),
          expectedBehavior: expectedBehavior.trim() || null,
          referenceLinks: normalizeReferenceLinks(referenceLinks),
          reviewChecklist: normalizeBriefList(reviewChecklist),
          updatedAt: new Date().toISOString(),
          updatedBy: brief?.updatedBy ?? null,
        },
      })
      setSaved(true)
    } catch (updateError) {
      setError(getMutationErrorMessage(updateError))
    }
  }

  return (
    <form
      onSubmit={saveBrief}
      className="rounded-xl border border-border-hairline bg-fill-translucent"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-hairline px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks className="size-4 shrink-0 text-text-muted" />
          <div className="flex items-center gap-2 text-heading-5 text-foreground">
            Implementation brief
          </div>
          {brief?.updatedAt ? (
            <p className="hidden truncate text-caption text-text-muted sm:block">
              Saved {new Date(brief.updatedAt).toLocaleString()}
              {brief.updatedBy ? ` by ${brief.updatedBy.name}` : ""}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={updateBriefMutation.isPending}
          className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-heading-5 text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-fill-translucent disabled:hover:text-text-body disabled:active:scale-100"
        >
          {updateBriefMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Save
        </button>
      </div>

      <div className="grid xl:grid-cols-2">
        <div className="border-b border-border-hairline xl:border-b-0 xl:border-r">
          <BriefTextarea
            label="Expected behavior"
            value={expectedBehavior}
            onChange={setExpectedBehavior}
            placeholder="Describe the desired product behavior."
          />
          <BriefListEditor
            addLabel="Add"
            items={reviewChecklist}
            label="Review checklist"
            onChange={setReviewChecklist}
            placeholder="Verify on tablet viewport"
          />
        </div>

        <div>
          <BriefTextarea
            label="Implementation plan"
            value={implementationNotes}
            onChange={setImplementationNotes}
            placeholder="Add the approach, context, or agent instructions."
            rows={6}
          />
          <ReferenceLinksEditor
            links={referenceLinks}
            onChange={setReferenceLinks}
          />
        </div>
      </div>

      {error || saved ? (
        <div className="border-t border-border-hairline px-4 py-3">
          {error ? (
            <p className="text-caption text-error">{error}</p>
          ) : (
            <p className="text-caption text-success">Implementation brief saved.</p>
          )}
        </div>
      ) : null}
    </form>
  )
}

function ActivityNotesPanel({
  currentUserId,
  currentUserRole,
  members,
  report,
  workspaceSlug,
}: ReportDetailProps) {
  return (
    <div className="space-y-4">
      <ReportWorkflowPanel
        key={`${report.id}:${report.assigneeUserId ?? "unassigned"}`}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        members={members}
        report={report}
        workspaceSlug={workspaceSlug}
      />

      <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
        <div className="flex items-center gap-2 text-heading-5 text-foreground">
          <MessageSquare className="size-4 text-text-muted" />
          Activity / Notes
        </div>
        <div className="mt-3 rounded-lg border border-border-hairline bg-background p-3">
          <p className="text-body-3 text-text-secondary">
            {report.commentsCount > 0
              ? `${report.commentsCount} comments`
              : "No comments yet."}
          </p>
        </div>
      </section>
    </div>
  )
}

export function ReportDetail({
  currentUserId,
  currentUserRole,
  members,
  report,
  workspaceSlug,
}: ReportDetailProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reportQuery = useReportDetailQuery({
    placeholderReport: report,
    reportId: report.id,
    workspaceSlug,
  })
  const currentReport = reportQuery.data?.report
    ? mergeReportCacheEntry(report, reportQuery.data.report)
    : report
  const isEvidenceHydrating =
    reportQuery.isFetching && currentReport.screenshots.length < 2
  const canManageReport =
    currentUserRole === "owner" || currentUserRole === "admin"
  const [activeTab, setActiveTab] = useState<ReportDetailTab>(() =>
    getAllowedReportDetailTab(searchParams.get("tab"), canManageReport)
  )
  const tabs: Array<{
    label: string
    value: ReportDetailTab
  }> = [
    { label: "Evidence", value: "evidence" },
    { label: "Activity / Notes", value: "activity" },
    ...(canManageReport
      ? [{ label: "Implementation brief", value: "brief" as const }]
      : []),
  ]

  function selectTab(tab: ReportDetailTab) {
    const nextTab = getAllowedReportDetailTab(tab, canManageReport)

    setActiveTab(nextTab)
    replaceUrlSearchParams(
      pathname,
      getDetailTabSearchParams(searchParams, nextTab)
    )
  }

  return (
    <section className="feedme-scrollbar h-full min-h-0 overflow-auto">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <Link
          href={`/${workspaceSlug}/reports?report=${currentReport.id}`}
          className="inline-flex items-center gap-1.5 text-body-3 text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to reports
        </Link>

        <header className="mt-3 border-b border-border-hairline pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <DetailBadge className={reportSeverityPillStyles[currentReport.severity]}>
              {currentReport.severity}
            </DetailBadge>
            <DetailBadge className={reportStatusPillStyles[currentReport.status]}>
              {getReportStatusLabel(currentReport.status)}
            </DetailBadge>
            <DetailBadge className={reportNeutralPillStyle}>
              {currentReport.type}
            </DetailBadge>
          </div>

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-heading-2 text-foreground">{currentReport.title}</h1>
              <p className="mt-1 max-w-3xl text-body-2 text-text-body">
                {currentReport.summary}
              </p>
            </div>
            <a
              href={currentReport.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
            >
              Open URL
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </header>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetadataItem label="Domain" value={currentReport.domain} />
          <MetadataItem label="Captured" value={currentReport.capturedAt} />
          <MetadataItem label="Owner" value={currentReport.assignee?.name ?? "Unassigned"} />
          <MetadataItem label="Comments" value={currentReport.commentsCount} />
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-5 border-b border-border-hairline">
            {tabs.map((tab) => {
              const selected = activeTab === tab.value

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => selectTab(tab.value)}
                  className={cn(
                    "relative -mb-px inline-flex h-9 cursor-pointer items-center justify-center border-b text-heading-5 transition-colors duration-base ease-out-soft",
                    selected
                      ? "border-primary-soft text-foreground"
                      : "border-transparent text-text-muted hover:text-text-body"
                  )}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 space-y-4">
            {activeTab === "evidence" ? (
              <>
                <ScreenshotPanel
                  isEvidenceHydrating={isEvidenceHydrating}
                  report={currentReport}
                />

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
                    <div className="flex items-center gap-2 text-heading-5 text-foreground">
                      <MessageSquare className="size-4 text-text-muted" />
                      Feedback
                    </div>
                    <blockquote className="mt-3 text-body-2 text-text-secondary">
                      {currentReport.feedback.message}
                    </blockquote>
                    <div className="mt-4 flex items-center gap-2 text-body-3 text-text-muted">
                      <FeedMeAvatar
                        className="shadow-none"
                        imageUrl={currentReport.feedback.reporterAvatarUrl}
                        label={currentReport.feedback.reporterName}
                        size={22}
                        value={currentReport.feedback.reporterEmail}
                      />
                      {currentReport.feedback.reporterName} -{" "}
                      {currentReport.feedback.reporterEmail}
                    </div>
                  </section>

                  <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
                    <div className="flex items-center gap-2 text-heading-5 text-foreground">
                      <MousePointer2 className="size-4 text-text-muted" />
                      Selected element
                    </div>
                    <div className="mt-3 rounded-lg border border-border-hairline bg-background p-3">
                      <p className="font-mono text-body-3 text-text-secondary">
                        {currentReport.selectedElement.selector}
                      </p>
                      {currentReport.selectedElement.text ? (
                        <p className="mt-2 text-body-3 text-text-body">
                          Text: {currentReport.selectedElement.text}
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>

                <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
                  <div className="flex items-center gap-2 text-heading-5 text-foreground">
                    <Code2 className="size-4 text-text-muted" />
                    Developer prompt
                  </div>
                  <pre className="feedme-scrollbar mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border-hairline bg-background p-3 font-mono text-caption text-text-secondary">
                    {currentReport.developerPrompt}
                  </pre>
                </section>
              </>
            ) : null}

            {activeTab === "activity" ? (
              <ActivityNotesPanel
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                members={members}
                report={currentReport}
                workspaceSlug={workspaceSlug}
              />
            ) : null}

            {activeTab === "brief" && canManageReport ? (
              <ImplementationBriefEditor
                key={currentReport.id}
                report={currentReport}
                workspaceSlug={workspaceSlug}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
