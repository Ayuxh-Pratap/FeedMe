"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Maximize2,
  MessageSquare,
  Monitor,
  MousePointer2,
  Play,
  Send,
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
  type WorkspaceReport,
  type WorkspaceReportStatus,
} from "@/lib/reports"
import type { WorkspaceMemberRole, WorkspaceTeamMember } from "@/lib/team-members"
import { ApiClientError, patchJson } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type ReportDetailProps = {
  currentUserId: string
  currentUserRole: WorkspaceMemberRole
  members: WorkspaceTeamMember[]
  report: WorkspaceReport
  workspaceSlug: string
}

type ReportScreenshot = WorkspaceReport["screenshots"][number]

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
}: {
  className?: string
  screenshot: ReportScreenshot
}) {
  if (screenshot.url) {
    return (
      <div className={cn("relative overflow-hidden bg-surface-card", className)}>
        <Image
          src={screenshot.url}
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

function ScreenshotPanel({ report }: { report: WorkspaceReport }) {
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
              <ScreenshotEvidence screenshot={screenshot} className="absolute inset-0" />
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

type ReportMutationResponse = {
  report: WorkspaceReport
}

function getReportMutationBaseUrl(workspaceSlug: string, reportId: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceSlug)}/reports/${encodeURIComponent(reportId)}`
}

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
  const router = useRouter()
  const [selectedAssigneeUserId, setSelectedAssigneeUserId] = useState(
    report.assigneeUserId ?? unassignedSelectValue
  )
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false)
  const [mutation, setMutation] = useState<"assignment" | "status" | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const developerMembers = members.filter(
    (member) => member.role === "developer" && member.status === "active"
  )
  const selectedDeveloper = developerMembers.find(
    (member) => member.userId === selectedAssigneeUserId
  )
  const canManageReport =
    currentUserRole === "owner" || currentUserRole === "admin"
  const isAssignedDeveloper =
    currentUserRole === "developer" && report.assigneeUserId === currentUserId
  const selectedAssigneeLabel =
    selectedAssigneeUserId === unassignedSelectValue
      ? "Unassigned"
      : selectedDeveloper?.name ?? report.assignee?.name ?? "Unknown developer"
  const hasAssignmentChange =
    selectedAssigneeUserId !== (report.assigneeUserId ?? unassignedSelectValue)
  const canStartWork = isAssignedDeveloper && report.status === "assigned"
  const canMarkReady =
    isAssignedDeveloper &&
    (report.status === "assigned" || report.status === "in_progress")
  const canResolve =
    canManageReport &&
    report.status !== "resolved" &&
    report.status !== "archived"
  const shouldShowPanel = canManageReport || isAssignedDeveloper

  if (!shouldShowPanel) {
    return null
  }

  async function updateAssignment() {
    setMutation("assignment")
    setError(null)
    setMessage(null)

    try {
      await patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/assignment`,
        {
          assigneeUserId:
            selectedAssigneeUserId === unassignedSelectValue
              ? null
              : selectedAssigneeUserId,
        }
      )
      setMessage("Assignment updated.")
      router.refresh()
    } catch (updateError) {
      setError(getMutationErrorMessage(updateError))
    } finally {
      setMutation(null)
    }
  }

  async function updateStatus(status: WorkspaceReportStatus, successMessage: string) {
    setMutation("status")
    setError(null)
    setMessage(null)

    try {
      await patchJson<ReportMutationResponse>(
        `${getReportMutationBaseUrl(workspaceSlug, report.id)}/status`,
        { status }
      )
      setMessage(successMessage)
      router.refresh()
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
          <p className="mt-1 text-body-3 text-text-body">
            Assign this report to a developer and move it through review.
          </p>
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
                disabled={mutation === "assignment"}
                onClick={() => setAssigneeMenuOpen((value) => !value)}
                className={cn(
                  "flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border-hairline bg-fill-translucent px-2.5 text-left text-body-3 text-text-secondary shadow-button-secondary outline-none transition-all duration-base ease-out-soft",
                  "hover:bg-fill-subtle hover:text-foreground hover:shadow-button-hover focus:border-border-strong active:scale-[var(--press-scale)]",
                  mutation === "assignment" &&
                    "cursor-not-allowed opacity-50 hover:bg-fill-translucent hover:text-text-secondary hover:shadow-button-secondary active:scale-100"
                )}
              >
                <span className="min-w-0 truncate">{selectedAssigneeLabel}</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-base ease-out-soft",
                    assigneeMenuOpen && "rotate-180 text-text-secondary"
                  )}
                />
              </button>

              {assigneeMenuOpen ? (
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
                    ...developerMembers.map((member) => ({
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
                          setMessage(null)
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
            {canResolve ? (
              <button
                type="button"
                disabled={isMutating}
                onClick={() => updateStatus("resolved", "Report resolved.")}
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

        {developerMembers.length === 0 && canManageReport ? (
          <p className="mt-2 text-caption text-text-muted">
            Invite an active developer before assigning work.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {isAssignedDeveloper ? (
            <>
              <button
                type="button"
                disabled={!canStartWork || isMutating}
                onClick={() => updateStatus("in_progress", "Work marked in progress.")}
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
                onClick={() =>
                  updateStatus("ready_for_review", "Report marked ready for review.")
                }
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
              onClick={() => updateStatus("resolved", "Report resolved.")}
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

        {message ? (
          <p className="mt-3 text-caption text-success">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-caption text-error">{error}</p>
        ) : null}
      </div>
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
  return (
    <section className="feedme-scrollbar h-full min-h-0 overflow-auto">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <Link
          href={`/${workspaceSlug}/reports?report=${report.id}`}
          className="inline-flex items-center gap-1.5 text-body-3 text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to reports
        </Link>

        <header className="mt-3 border-b border-border-hairline pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <DetailBadge className={reportSeverityPillStyles[report.severity]}>
              {report.severity}
            </DetailBadge>
            <DetailBadge className={reportStatusPillStyles[report.status]}>
              {getReportStatusLabel(report.status)}
            </DetailBadge>
            <DetailBadge className={reportNeutralPillStyle}>
              {report.type}
            </DetailBadge>
          </div>

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-heading-2 text-foreground">{report.title}</h1>
              <p className="mt-1 max-w-3xl text-body-2 text-text-body">
                {report.summary}
              </p>
            </div>
            <a
              href={report.url}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)]"
            >
              Open URL
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </header>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetadataItem label="Domain" value={report.domain} />
          <MetadataItem label="Captured" value={report.capturedAt} />
          <MetadataItem label="Owner" value={report.assignee?.name ?? "Unassigned"} />
          <MetadataItem label="Comments" value={report.commentsCount} />
        </div>

        <div className="mt-4 space-y-4">
          <ReportWorkflowPanel
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            members={members}
            report={report}
            workspaceSlug={workspaceSlug}
          />

          <ScreenshotPanel report={report} />

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
              <div className="flex items-center gap-2 text-heading-5 text-foreground">
                <MessageSquare className="size-4 text-text-muted" />
                Feedback
              </div>
              <blockquote className="mt-3 text-body-2 text-text-secondary">
                {report.feedback.message}
              </blockquote>
              <div className="mt-4 flex items-center gap-2 text-body-3 text-text-muted">
                <FeedMeAvatar
                  className="shadow-none"
                  imageUrl={report.feedback.reporterAvatarUrl}
                  label={report.feedback.reporterName}
                  size={22}
                  value={report.feedback.reporterEmail}
                />
                {report.feedback.reporterName} - {report.feedback.reporterEmail}
              </div>
            </section>

            <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
              <div className="flex items-center gap-2 text-heading-5 text-foreground">
                <MousePointer2 className="size-4 text-text-muted" />
                Selected element
              </div>
              <div className="mt-3 rounded-lg border border-border-hairline bg-background p-3">
                <p className="font-mono text-body-3 text-text-secondary">
                  {report.selectedElement.selector}
                </p>
                {report.selectedElement.text ? (
                  <p className="mt-2 text-body-3 text-text-body">
                    Text: {report.selectedElement.text}
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
              {report.developerPrompt}
            </pre>
          </section>
        </div>
      </div>
    </section>
  )
}
