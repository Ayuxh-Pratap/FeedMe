"use client"

import { Loader2, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"

export function DashboardInlineError({
  isRetrying = false,
  message,
  onRetry,
}: {
  isRetrying?: boolean
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-hairline bg-fill-translucent px-4 py-2">
      <p className="min-w-0 truncate text-caption text-error">{message}</p>
      <button
        type="button"
        disabled={isRetrying}
        onClick={onRetry}
        className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-2.5 text-caption font-medium text-foreground shadow-button-secondary transition-all duration-base ease-out-soft hover:border-border-strong hover:shadow-button-hover active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
      >
        {isRetrying ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <RefreshCw className="size-3" />
        )}
        Retry
      </button>
    </div>
  )
}

export function DashboardCenteredError({
  isRetrying = false,
  message,
  onRetry,
  title = "Unable to load this view",
}: {
  isRetrying?: boolean
  message: string
  onRetry: () => void
  title?: string
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-10">
      <div className="mx-auto max-w-[360px] text-center">
        <h2 className="text-heading-3 text-foreground">{title}</h2>
        <p className="mt-2 text-body-2 text-text-body">{message}</p>
        <button
          type="button"
          disabled={isRetrying}
          onClick={onRetry}
          className="mt-4 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-raised px-3 text-heading-5 text-foreground shadow-button-hover transition-all duration-base ease-out-soft hover:border-border-strong hover:brightness-110 active:scale-[var(--press-scale)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border-subtle disabled:hover:brightness-100 disabled:active:scale-100"
        >
          {isRetrying ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Retry
        </button>
      </div>
    </div>
  )
}

export function DashboardFreshnessNotice({
  count,
  isApplying = false,
  noun = "report",
  onApply,
}: {
  count: number
  isApplying?: boolean
  noun?: string
  onApply: () => void
}) {
  if (count <= 0) {
    return null
  }

  const label = `${count} new ${noun}${count === 1 ? "" : "s"}`

  return (
    <div className="border-b border-primary-soft/20 bg-primary/5 px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-caption font-medium text-primary">
          {label} available
        </p>
        <button
          type="button"
          disabled={isApplying}
          onClick={onApply}
          className={cn(
            "inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-primary-soft/40 bg-primary/15 px-2.5 text-caption font-medium text-primary transition-all duration-base ease-out-soft hover:bg-primary/20 active:scale-[var(--press-scale)]",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          )}
        >
          {isApplying ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Show
        </button>
      </div>
    </div>
  )
}
