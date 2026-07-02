import Link from "next/link"
import { Camera, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function EmptyReportIllustration() {
  return (
    <div className="relative mx-auto flex h-18 w-24 items-center justify-center" aria-hidden="true">
      <svg
        className="h-28 w-32 overflow-visible text-text-muted"
        fill="none"
        viewBox="0 0 112 80"
      >
        {/* <ellipse
          className="text-primary-alt"
          cx="56"
          cy="66"
          fill="currentColor"
          opacity="0.16"
          rx="36"
          ry="7"
        /> */}
        <rect
          className="text-border-strong"
          height="54"
          rx="13"
          stroke="currentColor"
          strokeDasharray="5 6"
          strokeWidth="1.35"
          width="96"
          x="8"
          y="3"
        />
        <circle
          className="text-primary-soft"
          cx="56"
          cy="30"
          fill="currentColor"
          opacity="0.9"
          r="10"
        />
        <path
          d="M51 30H61M56 25V35"
          stroke="var(--primary-foreground)"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}

type ReportsEmptyStateProps = {
  description?: string
  primaryActionHref?: string
  primaryActionLabel?: string
  showSecondaryAction?: boolean
  title?: string
}

export function ReportsEmptyState({
  description = "Once you capture your first report, it will appear here with screenshots, details, owners, and next steps.",
  primaryActionHref,
  primaryActionLabel = "Capture your first report",
  showSecondaryAction = true,
  title = "No feedback reports yet",
}: ReportsEmptyStateProps) {
  const primaryActionContent = (
    <span className="relative z-10 inline-flex items-center gap-2">
      <Camera className="size-4" />
      {primaryActionLabel}
    </span>
  )

  return (
    <section className="flex h-full items-center justify-center px-8 py-10">
      <div className="mx-auto max-w-[430px] text-center">
        <EmptyReportIllustration />
        <h1 className="mt-4 text-heading-3 text-foreground">{title}</h1>
        <p className="mx-auto mt-2 max-w-[360px] text-body-2 text-text-body">
          {description}
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            asChild={Boolean(primaryActionHref)}
            className={cn(
              "relative isolate h-10 overflow-hidden rounded-lg border-primary-soft/60 px-5 text-heading-5",
              "[background:var(--gradient-primary-premium)] text-primary-foreground shadow-[var(--elevation-primary-premium)]",
              "transition-all duration-base ease-out-soft hover:shadow-[var(--elevation-primary-premium-hover)]",
              "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:opacity-0 before:[background:var(--gradient-primary-premium-hover)]",
              "before:transition-opacity before:duration-base before:ease-out-soft hover:before:opacity-100",
              "after:pointer-events-none after:absolute after:right-[10%] after:top-px after:z-[1] after:h-px after:w-[60%] after:[background:var(--gradient-button-glint)]",
              "active:scale-[var(--press-scale)] active:translate-y-0"
            )}
          >
            {primaryActionHref ? (
              <Link href={primaryActionHref}>{primaryActionContent}</Link>
            ) : (
              primaryActionContent
            )}
          </Button>

          {showSecondaryAction ? (
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-2 text-body-3 text-text-muted transition-colors hover:text-text-secondary"
            >
              <Play className="size-4" />
              How FeedMe works in 60s
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
