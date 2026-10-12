"use client"

import { Info } from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function DemoModeInfo({ className }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="About this FeedMe demo"
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground",
              "transition-colors duration-base hover:bg-fill-subtle hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
              className
            )}
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={8}
          className="max-w-72 rounded-md border border-border-hairline bg-surface-card px-3 py-2 text-caption leading-relaxed text-text-secondary shadow-popover"
        >
          Public product demo. Email verification is disabled here, so you can
          create an account with any correctly formatted email or use the shared
          demo workspace.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
