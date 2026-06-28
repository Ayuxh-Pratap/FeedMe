import type { MockReportSummary } from "@/lib/mock/dashboard"

export const reportBadgeBaseClass =
  "relative isolate inline-flex h-5 items-center overflow-hidden rounded-md border px-1.5 text-caption font-medium capitalize shadow-button-hover after:pointer-events-none after:absolute after:inset-x-1 after:top-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/35 after:to-transparent"

export const reportSeverityPillStyles: Record<
  MockReportSummary["severity"],
  string
> = {
  urgent: "border-error/70 bg-error text-primary-foreground",
  high: "border-severity-high/70 bg-severity-high text-primary-foreground",
  medium: "border-severity-medium/70 bg-severity-medium text-primary-foreground",
  low: "border-success/70 bg-success text-primary-foreground",
}

export const reportSeverityPriorityLabels: Record<
  MockReportSummary["severity"],
  string
> = {
  urgent: "P0",
  high: "P1",
  medium: "P2",
  low: "P3",
}

export const reportPriorityCodeBaseClass =
  "inline-flex h-5 items-center rounded-md border px-1.5 text-caption font-medium"

export const reportPriorityCodePillStyle =
  "border-border-hairline bg-fill-translucent text-text-secondary"

export const reportStatusPillStyles: Record<
  MockReportSummary["status"],
  string
> = {
  open: "border-error/70 bg-error text-primary-foreground",
  triaged: "border-severity-medium/70 bg-severity-medium text-primary-foreground",
  in_progress: "border-severity-high/70 bg-severity-high text-primary-foreground",
  resolved: "border-success/70 bg-success text-primary-foreground",
}

export const reportNeutralPillStyle =
  "border-border-subtle bg-fill-translucent text-text-body shadow-button-secondary"
