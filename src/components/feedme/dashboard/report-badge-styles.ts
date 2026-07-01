import type { WorkspaceReport } from "@/lib/reports"

export const reportBadgeBaseClass =
  "relative isolate inline-flex h-5 items-center overflow-hidden rounded-md border px-1.5 text-caption font-medium capitalize shadow-button-hover after:pointer-events-none after:absolute after:inset-x-1 after:top-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/35 after:to-transparent"

export const reportSeverityPillStyles: Record<
  WorkspaceReport["severity"],
  string
> = {
  urgent: "border-error/70 bg-error text-primary-foreground",
  high: "border-severity-high/70 bg-severity-high text-primary-foreground",
  medium: "border-severity-medium/70 bg-severity-medium text-primary-foreground",
  low: "border-success/70 bg-success text-primary-foreground",
}

export const reportSeverityPriorityLabels: Record<
  WorkspaceReport["severity"],
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
  WorkspaceReport["status"],
  string
> = {
  submitted: "border-error/70 bg-error text-primary-foreground",
  reviewing: "border-severity-medium/70 bg-severity-medium text-primary-foreground",
  accepted: "border-severity-medium/70 bg-severity-medium text-primary-foreground",
  needs_info: "border-severity-medium/70 bg-severity-medium text-primary-foreground",
  duplicate: "border-border-subtle bg-fill-translucent text-text-body",
  rejected: "border-border-subtle bg-fill-translucent text-text-body",
  assigned: "border-severity-high/70 bg-severity-high text-primary-foreground",
  in_progress: "border-severity-high/70 bg-severity-high text-primary-foreground",
  ready_for_review: "border-severity-high/70 bg-severity-high text-primary-foreground",
  resolved: "border-success/70 bg-success text-primary-foreground",
  archived: "border-border-subtle bg-fill-translucent text-text-muted",
}

export const reportNeutralPillStyle =
  "border-border-subtle bg-fill-translucent text-text-body shadow-button-secondary"
