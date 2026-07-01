"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  Maximize2,
  MessageSquare,
  Monitor,
  MousePointer2,
  UserRound,
  X,
} from "lucide-react"

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
} from "@/lib/reports"
import { cn } from "@/lib/utils"

type ReportDetailProps = {
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
  kind: ReportScreenshot["kind"]
) {
  const match = report.viewport.match(/(\d+)\s*x\s*(\d+)/i)
  const width = match ? Number(match[1]) : 1440
  const height = match ? Number(match[2]) : 900

  if (kind === "page") {
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
    ? getScreenshotDimensions(report, selectedScreenshot.kind)
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

export function ReportDetail({ report, workspaceSlug }: ReportDetailProps) {
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
                <UserRound className="size-3.5" />
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
