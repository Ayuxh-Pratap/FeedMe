import type { ReactNode } from "react"

import { FeedMeBrand } from "@/components/feedme/brand"
import { AnimatedBars } from "@/components/feedme/experience/animated-bars"

type OnboardingShellProps = {
  children: ReactNode
}

function DesignSpace() {
  return (
    <AnimatedBars
      className="h-full bg-card"
      gradientFrom="color-mix(in srgb, var(--primary-alt) 58%, transparent)"
      gradientTo="color-mix(in srgb, var(--surface-card) 76%, transparent)"
      numBars={18}
    />
  )
}

export function OnboardingShell({ children }: OnboardingShellProps) {
  return (
    <main className="grid h-screen overflow-hidden bg-background text-foreground lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)]">
      <section className="relative flex h-screen items-center justify-center px-8 py-12 [view-transition-name:feedme-content-space] sm:px-12">
        <FeedMeBrand className="absolute left-8 top-7 sm:left-12" />
        {children}
      </section>

      <aside className="hidden h-screen overflow-hidden p-4 pl-0 [view-transition-name:feedme-design-space] lg:block">
        <div className="h-full overflow-hidden rounded-xl border border-border-hairline bg-card shadow-card">
          <DesignSpace />
        </div>
      </aside>
    </main>
  )
}
