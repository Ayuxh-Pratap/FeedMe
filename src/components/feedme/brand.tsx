import { MessageSquare } from "lucide-react"

import { cn } from "@/lib/utils"

type FeedMeBrandProps = {
  className?: string
  markClassName?: string
}

export function FeedMeBrand({ className, markClassName }: FeedMeBrandProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative isolate flex size-7 items-center justify-center overflow-hidden rounded-md border border-primary-soft/60",
          "[background:var(--gradient-primary-premium)] text-primary-foreground shadow-[var(--elevation-primary-premium)]",
          "after:pointer-events-none after:absolute after:right-[12%] after:top-px after:z-[1] after:h-px after:w-[62%] after:[background:var(--gradient-button-glint)]",
          markClassName
        )}
        aria-hidden="true"
      >
        <MessageSquare
          className="relative z-10 size-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.28)]"
          strokeWidth={2.4}
        />
      </div>
      <span className="text-heading-2 font-semibold tracking-[var(--tracking-ui)] text-foreground">
        FeedMe
      </span>
    </div>
  )
}
