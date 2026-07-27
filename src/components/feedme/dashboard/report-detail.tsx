"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { createPortal } from "react-dom"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  ExternalLink,
  CheckCircle2,
  Info,
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
  PencilLine,
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
  type WorkspaceReportActivityActor,
  type WorkspaceReportActivityItem,
  type WorkspaceReportComment,
  type WorkspaceReportNoteKind,
  type WorkspaceReportStatus,
} from "@/lib/reports"
import { getAssignedMemberNoteKinds } from "@/lib/report-workflow"
import {
  isAssignableReportRole,
  type WorkspaceMemberRole,
  type WorkspaceTeamMember,
} from "@/lib/team-members"
import { ApiClientError } from "@/lib/api-client"
import {
  useAssignReportMutation,
  useCreateReportCommentMutation,
  useCreateReportNoteMutation,
  useDeleteReportCommentMutation,
  useLoadReportCommentsMutation,
  useReportDetailQuery,
  useUpdateReportCommentMutation,
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
type ReportDetailTab = "evidence" | "activity" | "comments" | "brief"
type ReferenceLinkDraft = {
  id: string
  label: string
  url: string
}
type CommentMentionDraft = WorkspaceReportActivityActor & {
  label: string
}

const commentMaxLength = 5000

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

  const match = report.viewport?.match(/(\d+)\s*x\s*(\d+)/i)
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
        {!isEvidenceHydrating && report.screenshots.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border-hairline bg-surface-card px-6 text-center lg:col-span-2">
            <Camera className="size-4 text-text-muted" />
            <p className="text-heading-5 text-foreground">
              No screenshot evidence
            </p>
            <p className="max-w-sm text-caption text-text-muted">
              This task was created without visual evidence.
            </p>
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
    isAssignedImplementationMember && report.status === "in_progress"
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

  if (tab === "comments") {
    return "comments"
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

const noteKindLabels: Record<WorkspaceReportNoteKind, string> = {
  blocker: "Blocker",
  clarification: "Clarification",
  clarification_request: "Clarification request",
  review_note: "Review note",
  work_note: "Work note",
}

const noteKindDescriptions: Record<WorkspaceReportNoteKind, string> = {
  blocker: "Call out what is stopping progress.",
  clarification: "Add direction the assignee should know.",
  clarification_request: "Ask an admin or reporter for missing context.",
  review_note: "Add reviewer feedback or QA context.",
  work_note: "Share what changed or what you found.",
}

const noteKindIcon: Record<WorkspaceReportNoteKind, typeof MessageSquare> = {
  blocker: AlertTriangle,
  clarification: Info,
  clarification_request: CircleHelp,
  review_note: CheckCircle2,
  work_note: PencilLine,
}

function getAvailableNoteKinds({
  currentUserId,
  currentUserRole,
  report,
}: {
  currentUserId: string
  currentUserRole: WorkspaceMemberRole
  report: WorkspaceReport
}) {
  const kinds: WorkspaceReportNoteKind[] = []
  const canManageReport =
    currentUserRole === "owner" || currentUserRole === "admin"
  const isAssignedImplementationMember =
    isAssignableReportRole(currentUserRole) && report.assigneeUserId === currentUserId

  if (isAssignedImplementationMember) {
    kinds.push(...getAssignedMemberNoteKinds(report.status))
  }

  if (canManageReport) {
    kinds.push("clarification", "review_note")
  }

  return kinds
}

function getActivityActorLabel(actor: WorkspaceReportActivityActor | null | undefined) {
  return actor?.name ?? "Unknown teammate"
}

function ActivityItem({ item }: { item: WorkspaceReportActivityItem }) {
  if (item.type === "status") {
    return (
      <li className="flex gap-3 border-b border-border-hairline px-4 py-3 last:border-b-0">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border-hairline bg-fill-translucent text-text-muted">
          <CheckCircle2 className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-heading-5 text-foreground">
              {getActivityActorLabel(item.actor)} moved status to{" "}
              {getReportStatusLabel(item.toStatus)}
            </p>
            <span className="text-caption text-text-muted">{item.createdAgo}</span>
          </div>
          {item.note ? (
            <p className="mt-1 text-body-3 text-text-body">{item.note}</p>
          ) : null}
        </div>
      </li>
    )
  }

  const Icon = noteKindIcon[item.kind]

  return (
    <li className="flex gap-3 border-b border-border-hairline px-4 py-3 last:border-b-0">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border-hairline bg-fill-translucent text-text-muted">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-heading-5 text-foreground">
            {getActivityActorLabel(item.author)}
          </p>
          <span className="rounded-full border border-border-hairline bg-fill-translucent px-2 py-0.5 text-caption text-text-muted">
            {noteKindLabels[item.kind]}
          </span>
          <span className="text-caption text-text-muted">{item.createdAgo}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-body-3 text-text-body">
          {item.body}
        </p>
      </div>
    </li>
  )
}

function ActivityNotesPanel({
  currentUserId,
  currentUserRole,
  members,
  report,
  workspaceSlug,
}: ReportDetailProps) {
  const availableKinds = getAvailableNoteKinds({
    currentUserId,
    currentUserRole,
    report,
  })
  const currentMember = members.find((member) => member.userId === currentUserId)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [selectedKind, setSelectedKind] = useState<WorkspaceReportNoteKind | null>(
    availableKinds.includes("work_note") ? "work_note" : availableKinds[0] ?? null
  )
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const createNoteMutation = useCreateReportNoteMutation(workspaceSlug)
  const activity = report.activity ?? []
  const effectiveKind =
    selectedKind && availableKinds.includes(selectedKind)
      ? selectedKind
      : availableKinds[0]

  async function createNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedBody = body.trim()

    if (!trimmedBody || !effectiveKind) {
      return
    }

    setError(null)

    try {
      await createNoteMutation.mutateAsync({
        body: trimmedBody,
        kind: effectiveKind,
        optimisticActivityItem: {
          id: `optimistic-${makeDraftId()}`,
          type: "note",
          kind: effectiveKind,
          body: trimmedBody,
          createdAt: new Date().toISOString(),
          createdAgo: "Just now",
          author: currentMember
            ? {
                id: currentMember.userId,
                name: currentMember.name,
                email: currentMember.email,
                avatarUrl: currentMember.avatarUrl,
              }
            : null,
        },
        report,
      })
      setBody("")

      setNoteDialogOpen(false)
    } catch (updateError) {
      setError(getMutationErrorMessage(updateError))
    }
  }

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

      <section className="overflow-hidden rounded-xl border border-border-hairline bg-fill-translucent">
        <div className="flex items-center justify-between gap-3 border-b border-border-hairline px-4 py-2.5">
          <div className="flex items-center gap-2 text-heading-5 text-foreground">
            <MessageSquare className="size-4 text-text-muted" />
            Activity / Notes
          </div>
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-muted">
              {activity.length} {activity.length === 1 ? "item" : "items"}
            </span>
            {availableKinds.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setNoteDialogOpen(true)
                }}
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-heading-5 text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
              >
                <Plus className="size-3.5" />
                Add note
              </button>
            ) : null}
          </div>
        </div>

        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent className="gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:max-w-[520px]">
            <form onSubmit={createNote}>
              <div className="border-b border-border-hairline px-4 py-3">
                <DialogTitle className="text-heading-4 text-foreground">
                  Add workflow note
                </DialogTitle>
                <DialogDescription className="mt-1 text-body-3 text-text-body">
                  Notes are visible to the workspace and included in MCP handoff.
                </DialogDescription>
              </div>

              <div className="p-4">
                <div className="flex flex-wrap gap-1.5">
                  {availableKinds.map((kind) => {
                    const selected = effectiveKind === kind
                    const Icon = noteKindIcon[kind]

                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setSelectedKind(kind)}
                        className={cn(
                          "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2.5 text-heading-5 shadow-button-secondary transition-all duration-base ease-out-soft active:scale-[var(--press-scale)]",
                          selected
                            ? "border-border-subtle bg-surface-raised text-foreground shadow-button-hover"
                            : "border-border-hairline bg-fill-translucent text-text-body hover:bg-fill-subtle hover:text-foreground"
                        )}
                      >
                        <Icon className="size-3.5" />
                        {noteKindLabels[kind]}
                      </button>
                    )
                  })}
                </div>

                <label className="mt-3 block">
                  <span className="sr-only">
                    {effectiveKind ? noteKindLabels[effectiveKind] : "Workflow note"}
                  </span>
                  <textarea
                    value={body}
                    rows={5}
                    placeholder={
                      effectiveKind
                        ? noteKindDescriptions[effectiveKind]
                        : "Add context for this report."
                    }
                    onChange={(event) => setBody(event.target.value)}
                    className="feedme-scrollbar min-h-32 w-full resize-y rounded-lg border border-border-hairline bg-background px-3 py-2 text-body-3 text-text-secondary outline-none transition-all duration-base ease-out-soft placeholder:text-text-muted focus:border-border-strong focus:bg-surface-card"
                  />
                </label>

                {error ? (
                  <p className="mt-2 text-caption text-error">{error}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border-hairline px-4 py-3">
                <button
                  type="button"
                  onClick={() => setNoteDialogOpen(false)}
                  className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-heading-5 text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!body.trim() || !effectiveKind || createNoteMutation.isPending}
                  className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-subtle disabled:hover:brightness-100 disabled:active:scale-100"
                >
                  {createNoteMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Add note
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div>
          {activity.length > 0 ? (
            <ul>
              {activity.map((item) => (
                <ActivityItem key={`${item.type}-${item.id}`} item={item} />
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <div className="rounded-lg border border-dashed border-border-hairline bg-background p-4 text-body-3 text-text-muted">
                No activity yet.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function getCommentAuthorLabel(comment: WorkspaceReportComment) {
  if (comment.isDeleted) {
    return "Deleted comment"
  }

  return comment.author?.name ?? "Unknown teammate"
}

function getCommentElementId(commentId: string) {
  return `feedme-comment-${commentId}`
}

function findCommentPath(
  comments: WorkspaceReportComment[],
  targetCommentId: string
): string[] | null {
  for (const comment of comments) {
    if (comment.id === targetCommentId) {
      return [comment.id]
    }

    const childPath = findCommentPath(comment.replies, targetCommentId)

    if (childPath) {
      return [comment.id, ...childPath]
    }
  }

  return null
}

function getCommentIdsWithLoadedReplies(
  comments: WorkspaceReportComment[]
): string[] {
  const commentIds: string[] = []

  for (const comment of comments) {
    if (comment.replies.length > 0) {
      commentIds.push(comment.id)
      commentIds.push(...getCommentIdsWithLoadedReplies(comment.replies))
    }
  }

  return commentIds
}

function getMentionLabel(value: string) {
  const compactLabel = value
    .trim()
    .replace(/^@+/, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")

  return compactLabel || "teammate"
}

function getMemberMentionDraft(member: WorkspaceTeamMember): CommentMentionDraft {
  return {
    id: member.userId,
    name: member.displayName || member.name,
    email: member.email,
    avatarUrl: member.avatarUrl,
    label: getMentionLabel(member.displayName || member.name || member.email),
  }
}

function getActorMentionDraft(
  actor: WorkspaceReportActivityActor
): CommentMentionDraft {
  return {
    ...actor,
    label: getMentionLabel(actor.name || actor.email),
  }
}

function getMentionedUserIds(mentions: CommentMentionDraft[]) {
  return [...new Set(mentions.map((mention) => mention.id))]
}

function pruneMentionDrafts(
  mentions: CommentMentionDraft[],
  body: string
): CommentMentionDraft[] {
  const normalizedBody = body.toLocaleLowerCase()

  return mentions.filter((mention) =>
    normalizedBody.includes(`@${mention.label}`.toLocaleLowerCase())
  )
}

function resolveCommentMentionsFromBody({
  body,
  members,
  mentions,
}: {
  body: string
  members: WorkspaceTeamMember[]
  mentions: CommentMentionDraft[]
}) {
  const mentionsById = new Map<string, CommentMentionDraft>()

  for (const mention of mentions) {
    mentionsById.set(mention.id, mention)
  }

  const normalizedBody = body.toLocaleLowerCase()

  for (const member of members) {
    if (member.status !== "active") {
      continue
    }

    const mention = getMemberMentionDraft(member)

    if (normalizedBody.includes(`@${mention.label}`.toLocaleLowerCase())) {
      mentionsById.set(mention.id, mention)
    }
  }

  return [...mentionsById.values()]
}

function getMentionTrigger(value: string, cursor: number | null) {
  if (cursor === null || cursor < 0) {
    return null
  }

  const beforeCursor = value.slice(0, cursor)
  const match = /(^|\s)@([^\s@]*)$/u.exec(beforeCursor)

  if (!match) {
    return null
  }

  return {
    query: match[2] ?? "",
    start: beforeCursor.length - (match[2]?.length ?? 0) - 1,
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getCommentBodyParts(
  body: string,
  mentions: WorkspaceReportActivityActor[]
) {
  const uniqueMentions = new Map<string, WorkspaceReportActivityActor>()

  for (const mention of mentions) {
    uniqueMentions.set(
      getMentionLabel(mention.name || mention.email).toLocaleLowerCase(),
      mention
    )
  }

  const labels = [...uniqueMentions.keys()].sort(
    (first, second) => second.length - first.length
  )

  if (labels.length === 0) {
    return [{ text: body }] as Array<{
      mention?: WorkspaceReportActivityActor
      text: string
    }>
  }

  const mentionPattern = new RegExp(
    `@(${labels.map(escapeRegExp).join("|")})(?=\\b|$)`,
    "giu"
  )
  const parts: Array<{
    mention?: WorkspaceReportActivityActor
    text: string
  }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null = mentionPattern.exec(body)

  while (match) {
    if (match.index > lastIndex) {
      parts.push({ text: body.slice(lastIndex, match.index) })
    }

    const label = getMentionLabel(match[1] ?? "").toLocaleLowerCase()
    const mention = uniqueMentions.get(label)

    parts.push({
      mention,
      text: match[0],
    })
    lastIndex = match.index + match[0].length
    match = mentionPattern.exec(body)
  }

  if (lastIndex < body.length) {
    parts.push({ text: body.slice(lastIndex) })
  }

  return parts
}

function isMentionMenuEventTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("[data-feedme-mention-menu]"))
  )
}

function CommentBody({
  body,
  isDeleted,
  isOptimistic,
  mentions,
  onMentionClick,
}: {
  body: string
  isDeleted?: boolean
  isOptimistic?: boolean
  mentions: WorkspaceReportActivityActor[]
  onMentionClick: (mention: WorkspaceReportActivityActor) => void
}) {
  return (
    <p
      className={cn(
        "mt-1 whitespace-pre-wrap text-body-3",
        isDeleted ? "text-text-muted" : "text-text-body",
        isOptimistic ? "feedme-comment-text-shimmer" : ""
      )}
    >
      {getCommentBodyParts(body, mentions).map((part, index) => {
        if (!part.mention) {
          return <span key={`${part.text}-${index}`}>{part.text}</span>
        }

        return (
          <button
            key={`${part.mention.id}-${index}`}
            type="button"
            onClick={() => onMentionClick(part.mention as WorkspaceReportActivityActor)}
            title={part.mention.email}
            className="inline-flex cursor-pointer rounded px-0.5 font-semibold text-primary-soft transition-colors hover:bg-primary-soft/10 hover:text-primary"
          >
            {part.text}
          </button>
        )
      })}
    </p>
  )
}

function CommentMentionField({
  className,
  disabled,
  members,
  mentions,
  multiline = true,
  onMentionsChange,
  onValueChange,
  placeholder,
  rows = 3,
  value,
}: {
  className: string
  disabled?: boolean
  members: WorkspaceTeamMember[]
  mentions: CommentMentionDraft[]
  multiline?: boolean
  onMentionsChange: (mentions: CommentMentionDraft[]) => void
  onValueChange: (value: string) => void
  placeholder: string
  rows?: number
  value: string
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0)
  const [menuFrame, setMenuFrame] = useState<{
    left: number
    maxHeight: number
    top: number
    width: number
  } | null>(null)
  const [mentionTrigger, setMentionTrigger] = useState<{
    query: string
    start: number
  } | null>(null)
  const mentionCandidates = useMemo(
    () =>
      members
        .filter((member) => member.status === "active")
        .map(getMemberMentionDraft),
    [members]
  )
  const filteredCandidates = useMemo(() => {
    if (!mentionTrigger) {
      return []
    }

    const query = mentionTrigger.query.toLocaleLowerCase()

    return mentionCandidates
      .filter((candidate) => {
        if (mentions.some((mention) => mention.id === candidate.id)) {
          return false
        }

        return (
          candidate.name.toLocaleLowerCase().includes(query) ||
          candidate.email.toLocaleLowerCase().includes(query) ||
          candidate.label.toLocaleLowerCase().includes(query)
        )
      })
      .slice(0, 5)
  }, [mentionCandidates, mentionTrigger, mentions])
  const activeCandidate = filteredCandidates[activeCandidateIndex]

  useEffect(() => {
    if (!mentionTrigger || filteredCandidates.length === 0) {
      return
    }

    function updateMenuFrame() {
      const element = inputRef.current

      if (!element) {
        setMenuFrame(null)
        return
      }

      const rect = element.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const gap = 6
      const edgeGap = 8
      const menuWidth = Math.min(288, Math.max(220, viewportWidth - edgeGap * 2))
      const desiredHeight = Math.min(filteredCandidates.length * 48 + 2, 260)
      const spaceAbove = rect.top - edgeGap
      const spaceBelow = viewportHeight - rect.bottom - edgeGap
      const shouldOpenAbove = multiline
        ? spaceBelow < desiredHeight && spaceAbove > spaceBelow
        : spaceAbove >= desiredHeight || spaceAbove > spaceBelow
      const availableHeight = Math.max(
        120,
        shouldOpenAbove ? spaceAbove - gap : spaceBelow - gap
      )
      const maxHeight = Math.min(desiredHeight, availableHeight)
      const left = Math.min(
        Math.max(rect.left, edgeGap),
        viewportWidth - menuWidth - edgeGap
      )
      const top = shouldOpenAbove
        ? Math.max(edgeGap, rect.top - maxHeight - gap)
        : Math.min(viewportHeight - maxHeight - edgeGap, rect.bottom + gap)

      setMenuFrame({
        left,
        maxHeight,
        top,
        width: menuWidth,
      })
    }

    const frameId = window.requestAnimationFrame(updateMenuFrame)
    window.addEventListener("resize", updateMenuFrame)
    window.addEventListener("scroll", updateMenuFrame, true)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", updateMenuFrame)
      window.removeEventListener("scroll", updateMenuFrame, true)
    }
  }, [filteredCandidates.length, mentionTrigger, multiline])

  function updateMentionTrigger(
    element: HTMLInputElement | HTMLTextAreaElement,
    nextValue = element.value
  ) {
    const nextMentionTrigger = getMentionTrigger(nextValue, element.selectionStart)

    if (!nextMentionTrigger) {
      setMenuFrame(null)
    }

    if (mentionTrigger?.query !== nextMentionTrigger?.query) {
      setActiveCandidateIndex(0)
    }

    setMentionTrigger(nextMentionTrigger)
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (!mentionTrigger || filteredCandidates.length === 0) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveCandidateIndex((currentIndex) =>
        (currentIndex + 1) % filteredCandidates.length
      )
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveCandidateIndex((currentIndex) =>
        (currentIndex - 1 + filteredCandidates.length) %
        filteredCandidates.length
      )
      return
    }

    if (event.key === "Enter" && activeCandidate) {
      event.preventDefault()
      selectMention(activeCandidate)
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setMenuFrame(null)
      setMentionTrigger(null)
    }
  }

  function updateValue(nextValue: string) {
    onValueChange(nextValue)
    onMentionsChange(pruneMentionDrafts(mentions, nextValue))
  }

  function selectMention(mention: CommentMentionDraft) {
    const element = inputRef.current

    if (!element || !mentionTrigger) {
      return
    }

    const cursor = element.selectionStart ?? value.length
    const replacement = `@${mention.label} `
    const nextValue =
      value.slice(0, mentionTrigger.start) + replacement + value.slice(cursor)
    const nextCursor = mentionTrigger.start + replacement.length
    const nextMentions = pruneMentionDrafts(
      [...mentions, mention],
      nextValue
    )

    onValueChange(nextValue)
    onMentionsChange(nextMentions)
    setMenuFrame(null)
    setMentionTrigger(null)

    window.setTimeout(() => {
      element.focus()
      element.setSelectionRange(nextCursor, nextCursor)
    }, 0)
  }

  return (
    <div className={cn("relative", multiline ? "" : "min-w-0 flex-1")}>
      {multiline ? (
        <textarea
          ref={(element) => {
            inputRef.current = element
          }}
          value={value}
          rows={rows}
          maxLength={commentMaxLength}
          placeholder={placeholder}
          disabled={disabled}
          onBlur={() =>
            window.setTimeout(() => {
              setMenuFrame(null)
              setMentionTrigger(null)
            }, 120)
          }
          onChange={(event) => {
            updateValue(event.target.value)
            updateMentionTrigger(event.target, event.target.value)
          }}
          onClick={(event) => updateMentionTrigger(event.currentTarget)}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => updateMentionTrigger(event.currentTarget)}
          className={className}
        />
      ) : (
        <input
          ref={(element) => {
            inputRef.current = element
          }}
          type="text"
          value={value}
          maxLength={commentMaxLength}
          placeholder={placeholder}
          disabled={disabled}
          onBlur={() =>
            window.setTimeout(() => {
              setMenuFrame(null)
              setMentionTrigger(null)
            }, 120)
          }
          onChange={(event) => {
            updateValue(event.target.value)
            updateMentionTrigger(event.target, event.target.value)
          }}
          onClick={(event) => updateMentionTrigger(event.currentTarget)}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => updateMentionTrigger(event.currentTarget)}
          className={cn(className, "w-full")}
        />
      )}

      {filteredCandidates.length > 0 && menuFrame
        ? createPortal(
            <div
              data-feedme-mention-menu="true"
              className="feedme-scrollbar-hidden pointer-events-auto fixed z-[1000] overflow-auto rounded-lg border border-border-hairline bg-surface-card p-1 shadow-popover"
              style={{
                left: menuFrame.left,
                maxHeight: menuFrame.maxHeight,
                top: menuFrame.top,
                width: menuFrame.width,
              }}
            >
              {filteredCandidates.map((candidate, index) => (
                <button
                  key={candidate.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectMention(candidate)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-fill-subtle",
                    index === activeCandidateIndex && "bg-fill-subtle"
                  )}
                >
                  <FeedMeAvatar
                    className="shadow-none"
                    imageUrl={candidate.avatarUrl}
                    label={candidate.name}
                    size={24}
                    value={candidate.email}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-heading-5 text-foreground">
                      {candidate.name}
                    </span>
                    <span className="block truncate text-caption text-text-muted">
                      {candidate.email}
                    </span>
                  </span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

function CommentThread({
  canComment,
  copiedCommentId,
  comment,
  currentUserId,
  currentUserRole,
  deletingCommentIds,
  depth = 0,
  editBody,
  editMentions,
  editingCommentId,
  isPending,
  isRepliesCollapsed,
  isUpdatingComment,
  loadingRepliesForId,
  members,
  onCancelEdit,
  onCopyLink,
  onDelete,
  onEdit,
  onLoadReplies,
  onMentionClick,
  onReply,
  onStartReply,
  onStartEdit,
  onToggleReplies,
  replyBody,
  replyMentions,
  replyTargetId,
  setEditBody,
  setEditMentions,
  setReplyBody,
  setReplyMentions,
  targetCommentId,
}: {
  canComment: boolean
  copiedCommentId: string | null
  comment: WorkspaceReportComment
  currentUserId: string
  currentUserRole: WorkspaceMemberRole
  deletingCommentIds: Set<string>
  depth?: number
  editBody: string
  editMentions: CommentMentionDraft[]
  editingCommentId: string | null
  isPending: boolean
  isRepliesCollapsed: (commentId: string) => boolean
  isUpdatingComment: boolean
  loadingRepliesForId: string | null
  members: WorkspaceTeamMember[]
  onCancelEdit: () => void
  onCopyLink: (commentId: string) => void
  onDelete: (comment: WorkspaceReportComment) => void
  onEdit: (event: FormEvent<HTMLFormElement>, comment: WorkspaceReportComment) => void
  onLoadReplies: (comment: WorkspaceReportComment) => void
  onMentionClick: (mention: WorkspaceReportActivityActor) => void
  onReply: (event: FormEvent<HTMLFormElement>, parentCommentId: string) => void
  onStartEdit: (comment: WorkspaceReportComment) => void
  onStartReply: (commentId: string) => void
  onToggleReplies: (comment: WorkspaceReportComment) => void
  replyBody: string
  replyMentions: CommentMentionDraft[]
  replyTargetId: string | null
  setEditBody: (value: string) => void
  setEditMentions: (mentions: CommentMentionDraft[]) => void
  setReplyBody: (value: string) => void
  setReplyMentions: (mentions: CommentMentionDraft[]) => void
  targetCommentId?: string | null
}) {
  const isReplying = replyTargetId === comment.id
  const isEditing = editingCommentId === comment.id
  const canReply = canComment && !comment.isDeleted
  const loadedRepliesCount = comment.replies.length
  const hiddenRepliesCount = Math.max(comment.replyCount - loadedRepliesCount, 0)
  const isOptimisticComment = comment.id.startsWith("optimistic-")
  const isOwnComment = comment.author?.id === currentUserId
  const isCommentAdmin = currentUserRole === "owner" || currentUserRole === "admin"
  const canEdit = !comment.isDeleted && !isOptimisticComment && isOwnComment
  const canDelete =
    !comment.isDeleted && !isOptimisticComment && (isOwnComment || isCommentAdmin)
  const hasReplies = comment.replyCount > 0
  const hasLoadedReplies = loadedRepliesCount > 0
  const canLoadReplies =
    hasReplies &&
    (loadedRepliesCount === 0 || Boolean(comment.repliesPageInfo?.hasNextPage))
  const repliesCollapsed = isRepliesCollapsed(comment.id)
  const showReplies = hasLoadedReplies && !repliesCollapsed
  const isLoadingReplies = loadingRepliesForId === comment.id
  const isTargetComment = targetCommentId === comment.id
  const isDeletingComment = deletingCommentIds.has(comment.id)
  const repliesActionLabel = !hasLoadedReplies
    ? `View ${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}`
    : repliesCollapsed
      ? `Show ${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}`
      : "Hide replies"
  const replyActionLabel = isReplying ? "Cancel" : "Reply"

  return (
    <li
      id={getCommentElementId(comment.id)}
      className={cn(
        "scroll-mt-24 transition-colors duration-base ease-out-soft",
        depth === 0
          ? "border-b border-border-hairline px-4 py-3 last:border-b-0"
          : "px-0 py-2"
      )}
    >
      <div className={cn("flex gap-3", isDeletingComment && "opacity-60")}>
        <FeedMeAvatar
          className="mt-0.5 shadow-none"
          imageUrl={comment.author?.avatarUrl}
          label={getCommentAuthorLabel(comment)}
          size={28}
          value={comment.author?.email ?? comment.id}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-heading-5 text-foreground">
              {getCommentAuthorLabel(comment)}
            </p>
            <span className="text-caption text-text-muted">
              {comment.createdAgo}
            </span>
            {isTargetComment ? (
              <span
                aria-label="Selected comment"
                className="size-1.5 rounded-full bg-primary-soft shadow-[0_0_10px_color-mix(in_srgb,var(--primary-soft)_65%,transparent)]"
                title="Selected comment"
              />
            ) : null}
            {comment.editedAt && !comment.isDeleted ? (
              <span className="text-caption text-text-muted">Edited</span>
            ) : null}
          </div>

          {isEditing ? (
            <form
              onSubmit={(event) => onEdit(event, comment)}
              className="mt-1 space-y-2"
            >
              <CommentMentionField
                value={editBody}
                rows={2}
                members={members}
                mentions={editMentions}
                onMentionsChange={setEditMentions}
                onValueChange={setEditBody}
                placeholder="Enter your message"
                className="feedme-scrollbar min-h-16 w-full resize-y rounded-lg border border-border-hairline bg-background px-3 py-2 text-body-3 text-text-secondary outline-none transition-all duration-base ease-out-soft placeholder:text-text-muted focus:border-border-strong focus:bg-surface-card"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!editBody.trim() || isUpdatingComment}
                  className="inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md border border-border-hairline bg-fill-translucent px-2 text-caption text-text-body transition-colors hover:bg-fill-subtle hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUpdatingComment ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-0 text-caption text-text-muted transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <CommentBody
              body={comment.body}
              isDeleted={comment.isDeleted}
              isOptimistic={isOptimisticComment}
              mentions={resolveCommentMentionsFromBody({
                body: comment.body,
                members,
                mentions: comment.mentions.map(getActorMentionDraft),
              })}
              onMentionClick={onMentionClick}
            />
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {canReply && !isOptimisticComment ? (
              <button
                type="button"
                onClick={() => onStartReply(comment.id)}
                className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-0 text-caption text-text-muted transition-colors hover:text-foreground"
              >
                {replyActionLabel}
              </button>
            ) : null}

            {canEdit ? (
              <button
                type="button"
                onClick={() => onStartEdit(comment)}
                className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-0 text-caption text-text-muted transition-colors hover:text-foreground"
              >
                Edit
              </button>
            ) : null}

            {canDelete ? (
              <button
                type="button"
                onClick={() => onDelete(comment)}
                disabled={isDeletingComment}
                className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-0 text-caption text-text-muted transition-colors hover:text-error disabled:cursor-not-allowed disabled:hover:text-text-muted"
              >
                {isDeletingComment ? "Deleting" : "Delete"}
              </button>
            ) : null}

            {!comment.isDeleted && !isOptimisticComment ? (
              <button
                type="button"
                onClick={() => onCopyLink(comment.id)}
                className="inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md px-0 text-caption text-text-muted transition-colors hover:text-foreground"
              >
                <Link2 className="size-3" />
                {copiedCommentId === comment.id ? "Copied" : "Copy link"}
              </button>
            ) : null}

            {!comment.isDeleted && hasReplies ? (
              <button
                type="button"
                onClick={() => onToggleReplies(comment)}
                disabled={isLoadingReplies}
                className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-0 text-caption text-text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingReplies ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-base ease-out-soft",
                      hasLoadedReplies && !repliesCollapsed ? "rotate-180" : ""
                    )}
                  />
                )}
                {repliesActionLabel}
              </button>
            ) : null}
          </div>

          {isReplying ? (
            <form
              onSubmit={(event) => onReply(event, comment.id)}
              className="mt-1 flex items-center gap-2"
            >
              <CommentMentionField
                value={replyBody}
                multiline={false}
                members={members}
                mentions={replyMentions}
                onMentionsChange={setReplyMentions}
                placeholder="Enter your message"
                onValueChange={setReplyBody}
                className="h-8 min-w-0 flex-1 border-0 border-b border-border-hairline bg-transparent px-0 text-body-3 text-text-secondary outline-none transition-colors placeholder:text-text-muted focus:border-border-strong"
              />
              <button
                type="submit"
                aria-label="Send reply"
                disabled={!replyBody.trim() || isPending}
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-all duration-base ease-out-soft hover:bg-fill-translucent hover:text-foreground active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-text-muted disabled:active:scale-100"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {!comment.isDeleted && showReplies && canLoadReplies && loadedRepliesCount > 0 ? (
        <button
          type="button"
          onClick={() => onLoadReplies(comment)}
          disabled={isLoadingReplies}
          className="ml-10 mt-1 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-0 text-caption text-text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingReplies ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          {hiddenRepliesCount > 0
            ? `Load ${hiddenRepliesCount} more ${
                hiddenRepliesCount === 1 ? "reply" : "replies"
              }`
            : "Load more replies"}
        </button>
      ) : null}

      {showReplies ? (
        <ul className="ml-10 mt-2 border-l border-border-hairline pl-4">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              canComment={canComment}
              comment={reply}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              copiedCommentId={copiedCommentId}
              deletingCommentIds={deletingCommentIds}
              depth={depth + 1}
              editBody={editBody}
              editMentions={editMentions}
              editingCommentId={editingCommentId}
              isPending={isPending}
              isRepliesCollapsed={isRepliesCollapsed}
              isUpdatingComment={isUpdatingComment}
              loadingRepliesForId={loadingRepliesForId}
              members={members}
              onCancelEdit={onCancelEdit}
              onCopyLink={onCopyLink}
              onDelete={onDelete}
              onEdit={onEdit}
              onLoadReplies={onLoadReplies}
              onMentionClick={onMentionClick}
              onReply={onReply}
              onStartEdit={onStartEdit}
              onStartReply={onStartReply}
              onToggleReplies={onToggleReplies}
              replyBody={replyBody}
              replyMentions={replyMentions}
              replyTargetId={replyTargetId}
              setEditBody={setEditBody}
              setEditMentions={setEditMentions}
              setReplyBody={setReplyBody}
              setReplyMentions={setReplyMentions}
              targetCommentId={targetCommentId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function CommentsPanel({
  currentUserId,
  currentUserRole,
  isRepliesCollapsed,
  members,
  report,
  setRepliesCollapsed,
  targetCommentId,
  workspaceSlug,
}: ReportDetailProps & {
  isRepliesCollapsed: (commentId: string) => boolean
  setRepliesCollapsed: (commentId: string, collapsed: boolean) => void
  targetCommentId?: string | null
}) {
  const comments = useMemo(() => report.comments ?? [], [report.comments])
  const commentsPageInfo = report.commentsPageInfo
  const currentMember = members.find((member) => member.userId === currentUserId)
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [body, setBody] = useState("")
  const [bodyMentions, setBodyMentions] = useState<CommentMentionDraft[]>([])
  const [editBody, setEditBody] = useState("")
  const [editMentions, setEditMentions] = useState<CommentMentionDraft[]>([])
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [replyMentions, setReplyMentions] = useState<CommentMentionDraft[]>([])
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null)
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null)
  const [profileActor, setProfileActor] =
    useState<WorkspaceReportActivityActor | null>(null)
  const [deletingCommentIds, setDeletingCommentIds] = useState<Set<string>>(
    () => new Set()
  )
  const [loadingRepliesForId, setLoadingRepliesForId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const createCommentMutation = useCreateReportCommentMutation(workspaceSlug)
  const deleteCommentMutation = useDeleteReportCommentMutation(workspaceSlug)
  const loadCommentsMutation = useLoadReportCommentsMutation(workspaceSlug)
  const updateCommentMutation = useUpdateReportCommentMutation(workspaceSlug)
  const requestedTargetCommentIdsRef = useRef<Set<string>>(new Set())
  const revealedTargetCommentIdsRef = useRef<Set<string>>(new Set())
  const scrolledTargetCommentIdsRef = useRef<Set<string>>(new Set())
  const canComment = currentUserRole !== "viewer"
  const profileMember = profileActor
    ? members.find((member) => member.userId === profileActor.id)
    : undefined
  const isCommentActionPending =
    deleteCommentMutation.isPending ||
    updateCommentMutation.isPending

  useEffect(() => {
    if (!targetCommentId) {
      return
    }

    const commentPath = findCommentPath(comments, targetCommentId)

    if (!commentPath) {
      if (
        !requestedTargetCommentIdsRef.current.has(targetCommentId) &&
        !loadCommentsMutation.isPending
      ) {
        requestedTargetCommentIdsRef.current.add(targetCommentId)
        loadCommentsMutation.mutate({
          limit: 10,
          report,
          targetCommentId,
        })
      }

      return
    }

    if (!revealedTargetCommentIdsRef.current.has(targetCommentId)) {
      revealedTargetCommentIdsRef.current.add(targetCommentId)

      const ancestorCommentIds = new Set(commentPath.slice(0, -1))

      for (const commentId of getCommentIdsWithLoadedReplies(comments)) {
        const shouldCollapse = !ancestorCommentIds.has(commentId)

        if (isRepliesCollapsed(commentId) !== shouldCollapse) {
          setRepliesCollapsed(commentId, shouldCollapse)
        }
      }
    }

    if (scrolledTargetCommentIdsRef.current.has(targetCommentId)) {
      return
    }

    scrolledTargetCommentIdsRef.current.add(targetCommentId)

    window.setTimeout(() => {
      document
        .getElementById(getCommentElementId(targetCommentId))
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
    }, 80)
  }, [
    comments,
    isRepliesCollapsed,
    loadCommentsMutation,
    report,
    setRepliesCollapsed,
    targetCommentId,
  ])

  async function createComment({
    body: nextBody,
    mentions,
    parentCommentId,
  }: {
    body: string
    mentions: CommentMentionDraft[]
    parentCommentId?: string | null
  }) {
    const trimmedBody = nextBody.trim()

    if (!trimmedBody || !canComment) {
      return
    }

    setError(null)
    const resolvedMentions = resolveCommentMentionsFromBody({
      body: trimmedBody,
      members,
      mentions,
    })

    try {
      await createCommentMutation.mutateAsync({
        body: trimmedBody,
        mentionedUserIds: getMentionedUserIds(resolvedMentions),
        onOptimisticCommit: () => {
          if (parentCommentId) {
            setReplyBody("")
            setReplyMentions([])
            setReplyTargetId(null)
            setRepliesCollapsed(parentCommentId, false)
          } else {
            setBody("")
            setBodyMentions([])
            setCommentDialogOpen(false)
          }
        },
        parentCommentId,
        optimisticComment: {
          id: `optimistic-${makeDraftId()}`,
          parentCommentId: parentCommentId ?? null,
          body: trimmedBody,
          createdAt: new Date().toISOString(),
          createdAgo: "Just now",
          author: currentMember
            ? {
                id: currentMember.userId,
                name: currentMember.name,
                email: currentMember.email,
                avatarUrl: currentMember.avatarUrl,
              }
            : null,
          mentions: resolvedMentions,
          reactions: [],
          replyCount: 0,
          replies: [],
        },
        report,
      })
    } catch (updateError) {
      if (parentCommentId) {
        setReplyBody(trimmedBody)
        setReplyMentions(resolvedMentions)
        setReplyTargetId(parentCommentId)
      } else {
        setBody(trimmedBody)
        setBodyMentions(resolvedMentions)
        setCommentDialogOpen(true)
      }

      setError(getMutationErrorMessage(updateError))
    }
  }

  function createTopLevelComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void createComment({ body, mentions: bodyMentions })
  }

  function createReply(event: FormEvent<HTMLFormElement>, parentCommentId: string) {
    event.preventDefault()
    void createComment({
      body: replyBody,
      mentions: replyMentions,
      parentCommentId,
    })
  }

  function startEditComment(comment: WorkspaceReportComment) {
    setError(null)
    setReplyTargetId(null)
    setEditingCommentId((currentId) => {
      if (currentId === comment.id) {
        setEditBody("")
        setEditMentions([])
        return null
      }

      setEditBody(comment.body)
      setEditMentions(comment.mentions.map(getActorMentionDraft))
      return comment.id
    })
  }

  function cancelEditComment() {
    setEditBody("")
    setEditMentions([])
    setEditingCommentId(null)
  }

  function updateComment(
    event: FormEvent<HTMLFormElement>,
    comment: WorkspaceReportComment
  ) {
    event.preventDefault()

    const trimmedBody = editBody.trim()

    if (!trimmedBody || comment.isDeleted) {
      return
    }

    setError(null)
    const resolvedEditMentions = resolveCommentMentionsFromBody({
      body: trimmedBody,
      members,
      mentions: editMentions,
    })
    setEditingCommentId(null)
    setEditBody("")
    setEditMentions([])
    updateCommentMutation.mutate(
      {
        body: trimmedBody,
        comment,
        mentionedUserIds: getMentionedUserIds(resolvedEditMentions),
        optimisticComment: {
          ...comment,
          body: trimmedBody,
          editedAt: new Date().toISOString(),
          mentions: resolvedEditMentions,
        },
        report,
      },
      {
        onError: (updateError) => {
          setEditBody(trimmedBody)
          setEditMentions(resolvedEditMentions)
          setEditingCommentId(comment.id)
          setError(getMutationErrorMessage(updateError))
        },
      }
    )
  }

  function deleteComment(comment: WorkspaceReportComment) {
    if (comment.isDeleted) {
      return
    }

    setError(null)
    setDeletingCommentIds((currentIds) => new Set(currentIds).add(comment.id))
    deleteCommentMutation.mutate(
      {
        comment,
        optimisticComment: {
          ...comment,
          author: null,
          body: "Comment deleted",
          isDeleted: true,
          mentions: [],
          reactions: [],
        },
        report,
      },
      {
        onError: (deleteError) => {
          setError(getMutationErrorMessage(deleteError))
        },
        onSettled: () => {
          setDeletingCommentIds((currentIds) => {
            if (!currentIds.has(comment.id)) {
              return currentIds
            }

            const nextIds = new Set(currentIds)

            nextIds.delete(comment.id)
            return nextIds
          })
        },
      }
    )
  }

  function loadMoreComments() {
    if (!commentsPageInfo?.nextCursor) {
      return
    }

    loadCommentsMutation.mutate({
      cursor: commentsPageInfo.nextCursor,
      limit: commentsPageInfo.limit,
      report,
    })
  }

  function loadReplies(comment: WorkspaceReportComment) {
    if (loadingRepliesForId || !comment.replyCount) {
      return
    }

    const nextCursor =
      comment.replies.length > 0
        ? comment.repliesPageInfo?.nextCursor
        : null

    if (comment.replies.length > 0 && !nextCursor) {
      return
    }

    setLoadingRepliesForId(comment.id)
    loadCommentsMutation.mutate(
      {
        cursor: nextCursor,
        limit: comment.repliesPageInfo?.limit ?? 5,
        parentCommentId: comment.id,
        report,
      },
      {
        onSettled: () => setLoadingRepliesForId(null),
      }
    )
  }

  function toggleReplies(comment: WorkspaceReportComment) {
    if (!comment.replyCount || loadingRepliesForId) {
      return
    }

    if (comment.replies.length === 0) {
      setRepliesCollapsed(comment.id, false)
      loadReplies(comment)
      return
    }

    setRepliesCollapsed(comment.id, !isRepliesCollapsed(comment.id))
  }

  async function copyCommentLink(commentId: string) {
    const href = `/${workspaceSlug}/reports/${report.id}?tab=comments&comment=${commentId}`
    const absoluteHref =
      typeof window === "undefined" ? href : `${window.location.origin}${href}`

    try {
      await navigator.clipboard.writeText(absoluteHref)
      setCopiedCommentId(commentId)
      window.setTimeout(() => {
        setCopiedCommentId((currentId) =>
          currentId === commentId ? null : currentId
        )
      }, 1400)
    } catch {
      setError("Could not copy comment link.")
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border-hairline bg-fill-translucent">
      <div className="flex items-center justify-between gap-3 border-b border-border-hairline px-4 py-2.5">
        <div className="flex items-center gap-2 text-heading-5 text-foreground">
          <MessageSquare className="size-4 text-text-muted" />
          Comments
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption text-text-muted">
            {report.commentsCount} {report.commentsCount === 1 ? "comment" : "comments"}
          </span>
          {canComment ? (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setCommentDialogOpen(true)
              }}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-heading-5 text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
            >
              <Plus className="size-3.5" />
              Add comment
            </button>
          ) : null}
        </div>
      </div>

      <Dialog
        open={commentDialogOpen}
        onOpenChange={(open) => {
          setCommentDialogOpen(open)

          if (!open && !createCommentMutation.isPending) {
            setBody("")
            setBodyMentions([])
          }
        }}
      >
        <DialogContent
          className="gap-0 overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:max-w-[520px]"
          onInteractOutside={(event) => {
            if (isMentionMenuEventTarget(event.target)) {
              event.preventDefault()
            }
          }}
        >
          <form onSubmit={createTopLevelComment}>
            <div className="border-b border-border-hairline px-4 py-3">
              <DialogTitle className="text-heading-4 text-foreground">
                Add comment
              </DialogTitle>
              <DialogDescription className="mt-1 text-body-3 text-text-body">
                Use comments for discussion. Use Activity for implementation handoff.
              </DialogDescription>
            </div>

            <div className="p-4">
              <CommentMentionField
                value={body}
                rows={5}
                members={members}
                mentions={bodyMentions}
                placeholder="Write a comment"
                onMentionsChange={setBodyMentions}
                onValueChange={setBody}
                className="feedme-scrollbar min-h-32 w-full resize-y rounded-lg border border-border-hairline bg-background px-3 py-2 text-body-3 text-text-secondary outline-none transition-all duration-base ease-out-soft placeholder:text-text-muted focus:border-border-strong focus:bg-surface-card"
              />
              {error ? <p className="mt-2 text-caption text-error">{error}</p> : null}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border-hairline px-4 py-3">
              <span className="text-caption text-text-muted">
                {body.length}/{commentMaxLength}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCommentDialogOpen(false)
                    setBody("")
                    setBodyMentions([])
                  }}
                  className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-heading-5 text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!body.trim() || createCommentMutation.isPending}
                  className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-subtle disabled:hover:brightness-100 disabled:active:scale-100"
                >
                  {createCommentMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Comment
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(profileActor)}
        onOpenChange={(open) => {
          if (!open) {
            setProfileActor(null)
          }
        }}
      >
        <DialogContent className="overflow-hidden rounded-xl border border-border-hairline bg-surface-card p-0 text-foreground shadow-popover sm:max-w-[360px]">
          {profileActor ? (
            <div className="p-4">
              <div className="flex items-center gap-3">
                <FeedMeAvatar
                  className="shadow-none"
                  imageUrl={profileActor.avatarUrl}
                  label={profileActor.name}
                  size={40}
                  value={profileActor.email}
                />
                <div className="min-w-0">
                  <DialogTitle className="truncate text-heading-4 text-foreground">
                    {profileActor.name}
                  </DialogTitle>
                  <DialogDescription className="truncate text-body-3 text-text-body">
                    {profileActor.email}
                  </DialogDescription>
                </div>
              </div>

              {profileMember ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MetadataItem label="Role" value={profileMember.role} />
                  <MetadataItem
                    label="Assigned"
                    value={profileMember.assignedCount}
                  />
                  <MetadataItem
                    label="Completed"
                    value={profileMember.completedCount}
                  />
                  <MetadataItem
                    label="Reported"
                    value={profileMember.reportsCount}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {comments.length > 0 ? (
        <ul>
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              canComment={canComment}
              copiedCommentId={copiedCommentId}
              comment={comment}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              deletingCommentIds={deletingCommentIds}
              editBody={editBody}
              editMentions={editMentions}
              editingCommentId={editingCommentId}
              isPending={createCommentMutation.isPending}
              isRepliesCollapsed={isRepliesCollapsed}
              isUpdatingComment={isCommentActionPending}
              loadingRepliesForId={loadingRepliesForId}
              members={members}
              onCancelEdit={cancelEditComment}
              onCopyLink={copyCommentLink}
              onDelete={deleteComment}
              onEdit={updateComment}
              onLoadReplies={loadReplies}
              onMentionClick={setProfileActor}
              onReply={createReply}
              onStartEdit={startEditComment}
              onStartReply={(commentId) => {
                setError(null)
                setEditingCommentId(null)
                setReplyBody("")
                setReplyMentions([])
                setReplyTargetId((currentTargetId) =>
                  currentTargetId === commentId ? null : commentId
                )
              }}
              onToggleReplies={toggleReplies}
              replyBody={replyBody}
              replyMentions={replyMentions}
              replyTargetId={replyTargetId}
              setEditBody={setEditBody}
              setEditMentions={setEditMentions}
              setReplyBody={setReplyBody}
              setReplyMentions={setReplyMentions}
              targetCommentId={targetCommentId}
            />
          ))}
        </ul>
      ) : (
        <div className="p-4">
          <div className="rounded-lg border border-dashed border-border-hairline bg-background p-4 text-body-3 text-text-muted">
            No comments yet.
          </div>
        </div>
      )}

      {commentsPageInfo?.hasNextPage ? (
        <div className="border-t border-border-hairline p-3">
          <button
            type="button"
            onClick={loadMoreComments}
            disabled={loadCommentsMutation.isPending}
            className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-heading-5 text-text-body shadow-button-secondary transition-all duration-base ease-out-soft hover:bg-fill-subtle hover:text-foreground active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-fill-translucent disabled:hover:text-text-body disabled:active:scale-100"
          >
            {loadCommentsMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Load more comments
          </button>
        </div>
      ) : null}
    </section>
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
  const currentReport = reportQuery.data?.report ?? report
  const isEvidenceHydrating =
    currentReport.source === "feedback" &&
    reportQuery.isFetching &&
    currentReport.screenshots.length < 2
  const canManageReport =
    currentUserRole === "owner" || currentUserRole === "admin"
  const requestedTab = getAllowedReportDetailTab(
    searchParams.get("tab"),
    canManageReport
  )
  const targetCommentId = searchParams.get("comment")
  const activeTab = requestedTab
  const [collapsedReplyIds, setCollapsedReplyIds] = useState<Set<string>>(
    () => new Set()
  )
  const tabs: Array<{
    label: string
    value: ReportDetailTab
  }> = [
    {
      label: currentReport.source === "task" ? "Details" : "Evidence",
      value: "evidence",
    },
    { label: "Activity / Notes", value: "activity" },
    { label: "Comments", value: "comments" },
    ...(canManageReport
      ? [{ label: "Implementation brief", value: "brief" as const }]
      : []),
  ]

  function selectTab(tab: ReportDetailTab) {
    const nextTab = getAllowedReportDetailTab(tab, canManageReport)

    replaceUrlSearchParams(
      pathname,
      getDetailTabSearchParams(searchParams, nextTab)
    )
  }

  function isRepliesCollapsed(commentId: string) {
    return collapsedReplyIds.has(commentId)
  }

  function setRepliesCollapsed(commentId: string, collapsed: boolean) {
    setCollapsedReplyIds((currentIds) => {
      const isCurrentlyCollapsed = currentIds.has(commentId)

      if (isCurrentlyCollapsed === collapsed) {
        return currentIds
      }

      const nextIds = new Set(currentIds)

      if (collapsed) {
        nextIds.add(commentId)
      } else {
        nextIds.delete(commentId)
      }

      return nextIds
    })
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
            {currentReport.source === "task" ? (
              <DetailBadge className={reportNeutralPillStyle}>Task</DetailBadge>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-heading-2 text-foreground">{currentReport.title}</h1>
              <p className="mt-1 max-w-3xl text-body-2 text-text-body">
                {currentReport.summary}
              </p>
            </div>
            {currentReport.url ? (
              <a
                href={currentReport.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
              >
                Open URL
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
        </header>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetadataItem
            label={currentReport.source === "task" ? "Source URL" : "Domain"}
            value={
              currentReport.source === "task"
                ? currentReport.url ?? "Not provided"
                : currentReport.domain ?? "Unknown"
            }
          />
          <MetadataItem
            label={currentReport.source === "task" ? "Created" : "Captured"}
            value={currentReport.capturedAt}
          />
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
                {currentReport.source === "feedback" ? (
                  <ScreenshotPanel
                    isEvidenceHydrating={isEvidenceHydrating}
                    report={currentReport}
                  />
                ) : null}

                <div
                  className={cn(
                    "grid gap-4",
                    currentReport.selectedElement && "xl:grid-cols-2"
                  )}
                >
                  <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
                    <div className="flex items-center gap-2 text-heading-5 text-foreground">
                      <MessageSquare className="size-4 text-text-muted" />
                      {currentReport.source === "task"
                        ? "Task description"
                        : "Feedback"}
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
                      {currentReport.source === "task" ? "Created by " : null}
                      {currentReport.feedback.reporterName} -{" "}
                      {currentReport.feedback.reporterEmail}
                    </div>
                  </section>

                  {currentReport.selectedElement ? (
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
                  ) : null}
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

            {activeTab === "comments" ? (
              <CommentsPanel
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                isRepliesCollapsed={isRepliesCollapsed}
                members={members}
                report={currentReport}
                setRepliesCollapsed={setRepliesCollapsed}
                targetCommentId={targetCommentId}
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
