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

// Mirrors the ReportDetail layout region-for-region so the detail route resolves
// without a layout shift when the real report arrives. The detail route has no
// right rail, so this owns the full canvas.
export function ReportDetailLoading() {
  return (
    <section aria-busy="true" className="feedme-scrollbar h-full min-h-0 overflow-auto">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <SkeletonBlock className="h-3.5 w-28 border-0" />

        <header className="mt-3 border-b border-border-hairline pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <SkeletonBlock className="h-5 w-16" />
            <SkeletonBlock className="h-5 w-20" />
            <SkeletonBlock className="h-5 w-14" />
          </div>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-8 w-2/3 border-0" />
              <SkeletonBlock className="mt-2 h-4 w-full max-w-3xl border-0" />
              <SkeletonBlock className="mt-1.5 h-4 w-4/5 max-w-2xl border-0" />
            </div>
            <SkeletonBlock className="h-8 w-24 shrink-0" />
          </div>
        </header>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border border-border-hairline bg-fill-translucent px-3 py-2"
            >
              <SkeletonBlock className="h-2.5 w-14 border-0" />
              <SkeletonBlock className="mt-2 h-3.5 w-20 border-0" />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          <section className="rounded-xl border border-border-hairline bg-fill-translucent">
            <div className="flex flex-col gap-3 border-b border-border-hairline px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <SkeletonBlock className="h-4 w-24 border-0" />
                <SkeletonBlock className="mt-2 h-3 w-56 max-w-full border-0" />
              </div>
              <SkeletonBlock className="h-5 w-20" />
            </div>
            <div className="p-3">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <SkeletonBlock className="h-9" />
                <SkeletonBlock className="h-9 w-28" />
                <SkeletonBlock className="h-9 w-24" />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border-hairline bg-fill-translucent">
            <div className="flex h-10 items-center justify-between border-b border-border-hairline px-4">
              <SkeletonBlock className="h-3.5 w-32 border-0" />
              <SkeletonBlock className="h-3 w-10 border-0" />
            </div>
            <div className="grid gap-3 p-3 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border border-border-hairline bg-background"
                >
                  <div className="flex h-8 items-center justify-between border-b border-border-hairline px-3">
                    <SkeletonBlock className="h-2.5 w-16 border-0" />
                    <SkeletonBlock className="h-2.5 w-10 border-0" />
                  </div>
                  <div className="aspect-[16/10] animate-pulse bg-fill-translucent" />
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
              <SkeletonBlock className="h-4 w-24 border-0" />
              <SkeletonBlock className="mt-3 h-4 w-full border-0" />
              <SkeletonBlock className="mt-2 h-4 w-4/5 border-0" />
              <div className="mt-4 flex items-center gap-2">
                <SkeletonBlock className="size-[22px] rounded-full border-0" />
                <SkeletonBlock className="h-3 w-40 border-0" />
              </div>
            </section>
            <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
              <SkeletonBlock className="h-4 w-32 border-0" />
              <div className="mt-3 rounded-lg border border-border-hairline bg-background p-3">
                <SkeletonBlock className="h-3 w-full border-0" />
                <SkeletonBlock className="mt-2 h-3 w-2/3 border-0" />
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-border-hairline bg-fill-translucent p-4">
            <SkeletonBlock className="h-4 w-36 border-0" />
            <div className="mt-3 space-y-2 rounded-lg border border-border-hairline bg-background p-3">
              <SkeletonBlock className="h-3 w-full border-0" />
              <SkeletonBlock className="h-3 w-11/12 border-0" />
              <SkeletonBlock className="h-3 w-5/6 border-0" />
              <SkeletonBlock className="h-3 w-3/4 border-0" />
            </div>
          </section>
        </div>
      </div>
    </section>
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

export function DashboardReportTableSkeleton({
  rows = 7,
}: {
  rows?: number
}) {
  return (
    <div
      aria-busy="true"
      className="feedme-scrollbar min-h-0 flex-1 overflow-auto"
    >
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
        <caption className="sr-only">Loading reports</caption>
        <colgroup>
          <col className="w-[46%]" />
          <col className="w-28" />
          <col className="w-[22%]" />
          <col className="w-[24%]" />
        </colgroup>
        <thead className="border-b border-border-hairline">
          <tr>
            <th className="px-4 py-3" scope="col">
              <SkeletonBlock className="h-3 w-14 border-0" />
            </th>
            <th className="px-4 py-3" scope="col">
              <SkeletonBlock className="h-3 w-16 border-0" />
            </th>
            <th className="px-4 py-3" scope="col">
              <SkeletonBlock className="h-3 w-14 border-0" />
            </th>
            <th className="px-4 py-3" scope="col">
              <SkeletonBlock className="h-3 w-16 border-0" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index} className="border-b border-border-hairline">
              <td className="px-4 py-4 align-top">
                <SkeletonBlock className="h-4 w-64 max-w-full border-0" />
                <SkeletonBlock className="mt-2 h-3 w-80 max-w-full border-0" />
              </td>
              <td className="px-4 py-4 align-top">
                <SkeletonBlock className="h-6 w-10 border-0" />
              </td>
              <td className="px-4 py-4 align-top">
                <SkeletonBlock className="h-4 w-36 max-w-full border-0" />
              </td>
              <td className="px-4 py-4 align-top">
                <div className="flex items-center gap-3">
                  <SkeletonBlock className="size-7 shrink-0 rounded-full border-0" />
                  <SkeletonBlock className="h-4 w-24 min-w-0 border-0" />
                  <SkeletonBlock className="ml-auto h-4 w-12 shrink-0 border-0" />
                  <SkeletonBlock className="size-7 shrink-0 border-0" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DashboardTeamTableSkeleton({
  rows = 7,
}: {
  rows?: number
}) {
  return (
    <div
      aria-busy="true"
      className="feedme-scrollbar min-h-0 flex-1 overflow-auto"
    >
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
        <caption className="sr-only">Loading team members</caption>
        <colgroup>
          <col className="w-[42%]" />
          <col className="w-[13%]" />
          <col className="w-[10%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead className="border-b border-border-hairline">
          <tr>
            {Array.from({ length: 6 }).map((_, index) => (
              <th key={index} className="px-4 py-3" scope="col">
                <SkeletonBlock className="h-3 w-14 border-0" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index} className="border-b border-border-hairline">
              <td className="px-4 py-4 align-top">
                <div className="flex min-w-0 items-center gap-2">
                  <SkeletonBlock className="size-7 shrink-0 rounded-full border-0" />
                  <div className="min-w-0 flex-1">
                    <SkeletonBlock className="h-4 w-44 max-w-full border-0" />
                    <SkeletonBlock className="mt-2 h-3 w-64 max-w-full border-0" />
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 align-top">
                <SkeletonBlock className="h-5 w-20 border-0" />
              </td>
              <td className="px-4 py-4 align-top">
                <SkeletonBlock className="h-4 w-8 border-0" />
              </td>
              <td className="px-4 py-4 align-top">
                <SkeletonBlock className="h-4 w-8 border-0" />
              </td>
              <td className="px-4 py-4 align-top">
                <SkeletonBlock className="h-4 w-8 border-0" />
              </td>
              <td className="px-4 py-4 align-top">
                <SkeletonBlock className="h-4 w-24 border-0" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
