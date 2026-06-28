import type { ReactNode } from "react"
import { ArrowUpRight } from "lucide-react"

import { FeedMeBrand } from "@/components/feedme/brand"
import { AnimatedBars } from "@/components/feedme/experience/animated-bars"

type OnboardingShellProps = {
  children: ReactNode
}

function DesignSpace() {
  return (
    <AnimatedBars
      className="h-full bg-background"
      gradientFrom="color-mix(in srgb, var(--primary-alt) 58%, transparent)"
      gradientTo="color-mix(in srgb, var(--background) 76%, transparent)"
      numBars={18}
    >
      <div className="flex h-full flex-col justify-between p-7 sm:p-8 lg:p-9">
        <nav
          aria-label="Product links"
          className="ml-auto flex items-center gap-5 text-body-3 font-medium text-text-muted"
        >
          <a className="inline-flex items-center gap-1 transition-colors hover:text-text-secondary" href="/login">
            How it works
            <ArrowUpRight className="size-3" />
          </a>
          <a className="inline-flex items-center gap-1 transition-colors hover:text-text-secondary" href="/login">
            Extension
            <ArrowUpRight className="size-3" />
          </a>
        </nav>

        <div className="ml-auto max-w-[390px] pb-2 text-right">
          <p className="text-body-3 font-semibold uppercase text-foreground/75">Feedback workspace</p>
          <h2 className="mt-3 text-heading-1 text-foreground">
            Capture context once. Move the team faster.
          </h2>
          <p className="ml-auto mt-4 max-w-[330px] text-body-1 text-foreground/80">
            Turn messy screenshots and notes into clear reports, owners, and next steps.
          </p>
        </div>
      </div>
    </AnimatedBars>
  )
}

export function OnboardingShell({ children }: OnboardingShellProps) {
  return (
    <main className="grid h-screen overflow-hidden bg-card text-foreground lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)]">
      <section className="relative flex h-screen items-center justify-center px-8 py-12 [view-transition-name:feedme-content-space] sm:px-12">
        <FeedMeBrand className="absolute left-8 top-7 sm:left-12" />
        {children}
      </section>

      <aside className="hidden h-screen overflow-hidden p-4 pl-0 [view-transition-name:feedme-design-space] lg:block">
        <div className="h-full overflow-hidden rounded-xl border border-border-hairline bg-background shadow-card">
          <DesignSpace />
        </div>
      </aside>
    </main>
  )
}
