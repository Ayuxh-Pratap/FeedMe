import { cn } from "@/lib/utils"

function SkeletonBlock({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md border border-border-hairline bg-fill-translucent",
        className
      )}
    />
  )
}

export function DashboardTableLoading({
  subtitle = "Preparing the latest workspace data.",
  title = "Loading workspace",
}: {
  subtitle?: string
  title?: string
}) {
  return (
    <section
      aria-busy="true"
      className="flex h-full min-h-0 flex-col"
    >
      <header className="shrink-0 border-b border-border-hairline px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-heading-3 text-foreground">{title}</h1>
            <p className="mt-1 text-body-3 text-text-body">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SkeletonBlock className="h-9 w-64" />
            <SkeletonBlock className="h-9 w-36" />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="border-b border-border-hairline px-4 py-3">
          <div className="grid grid-cols-[minmax(18rem,1fr)_8rem_12rem_16rem] gap-4">
            <SkeletonBlock className="h-3 w-14 border-0" />
            <SkeletonBlock className="h-3 w-16 border-0" />
            <SkeletonBlock className="h-3 w-14 border-0" />
            <SkeletonBlock className="h-3 w-16 border-0" />
          </div>
        </div>

        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(18rem,1fr)_8rem_12rem_16rem] gap-4 border-b border-border-hairline px-4 py-4"
          >
            <div>
              <SkeletonBlock className="h-4 w-56 border-0" />
              <SkeletonBlock className="mt-2 h-3 w-72 max-w-full border-0" />
            </div>
            <SkeletonBlock className="h-6 w-10 border-0" />
            <SkeletonBlock className="h-4 w-36 border-0" />
            <div className="flex items-center gap-3">
              <SkeletonBlock className="size-7 rounded-full border-0" />
              <SkeletonBlock className="h-4 w-24 border-0" />
              <SkeletonBlock className="ml-auto size-7 border-0" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
