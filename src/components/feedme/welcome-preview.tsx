import { ListChecks, MessageSquare, Settings } from "lucide-react"

export function WelcomePreviewPlaceholder() {
  // Future FeedMe preview widget goes here: captured report, member feedback, or next-step handoff.
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-12">
      <div className="absolute left-0 top-0 h-full w-px bg-border-hairline" />
      <div className="relative w-full max-w-[360px] rounded-xl border border-border-hairline bg-surface-panel shadow-popover">
        <div className="flex h-16 items-center justify-between border-b border-border-hairline px-6">
          <div className="flex items-center gap-5 text-muted-foreground">
            <MessageSquare className="size-4" />
            <ListChecks className="size-4 text-primary" />
          </div>
          <Settings className="size-4 text-muted-foreground" />
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded-xl border border-border-hairline bg-fill-translucent p-4 shadow-card">
            <div className="mb-4 h-3 w-28 rounded-full bg-fill-subtle" />
            <div className="h-3 w-full rounded-full bg-fill-subtle" />
            <div className="mt-2 h-3 w-4/5 rounded-full bg-fill-subtle" />
          </div>
          <div className="rounded-xl border border-border-hairline bg-fill-translucent p-4 shadow-card">
            <div className="mb-4 h-3 w-20 rounded-full bg-fill-subtle" />
            <div className="h-3 w-11/12 rounded-full bg-fill-subtle" />
            <div className="mt-2 h-3 w-2/3 rounded-full bg-fill-subtle" />
          </div>
          <div className="rounded-xl border border-dashed border-border-hairline p-4">
            <div className="h-3 w-32 rounded-full bg-fill-subtle" />
          </div>
        </div>
        <div className="flex gap-2 border-t border-border-hairline p-4">
          <div className="h-11 flex-1 rounded-lg shadow-button [background:var(--gradient-primary)]" />
          <div className="h-11 w-16 rounded-lg bg-secondary shadow-button-secondary" />
        </div>
      </div>
    </div>
  )
}
