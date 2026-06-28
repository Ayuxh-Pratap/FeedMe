import type { CSSProperties, ReactNode } from "react"

import { cn } from "@/lib/utils"

type AnimatedBarsProps = {
  numBars?: number
  gradientFrom?: string
  gradientTo?: string
  animationDuration?: number
  children?: ReactNode
  className?: string
}

export function AnimatedBars({
  numBars = 16,
  gradientFrom = "color-mix(in srgb, var(--primary-alt) 68%, transparent)",
  gradientTo = "transparent",
  animationDuration = 4,
  children,
  className,
}: AnimatedBarsProps) {
  const atmosphereStyle: CSSProperties = {
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 10%, transparent) 0%, transparent 42%, color-mix(in srgb, var(--primary-alt) 8%, transparent) 100%)",
  }
  const topArcFadeStyle: CSSProperties = {
    background:
      "radial-gradient(165% 112% at 50% -24%, var(--background) 0%, color-mix(in srgb, var(--background) 99%, transparent) 38%, color-mix(in srgb, var(--background) 84%, transparent) 54%, color-mix(in srgb, var(--background) 46%, transparent) 74%, transparent 100%)",
  }
  const bottomArcFadeStyle: CSSProperties = {
    background:
      "radial-gradient(118% 112% at 104% 122%, var(--background) 0%, color-mix(in srgb, var(--background) 98%, transparent) 34%, color-mix(in srgb, var(--background) 78%, transparent) 52%, color-mix(in srgb, var(--background) 36%, transparent) 72%, transparent 100%)",
  }
  const rightArcFadeStyle: CSSProperties = {
    background:
      "radial-gradient(118% 104% at 116% 48%, color-mix(in srgb, var(--background) 94%, transparent) 0%, color-mix(in srgb, var(--background) 76%, transparent) 32%, color-mix(in srgb, var(--background) 38%, transparent) 58%, transparent 82%)",
  }
  const sharedShimmerStyle: CSSProperties = {
    animation: `feedme-panel-shimmer ${animationDuration * 2.25}s ease-in-out infinite alternate`,
    background:
      "linear-gradient(105deg, transparent 0%, transparent 28%, color-mix(in srgb, white 8%, transparent) 42%, color-mix(in srgb, var(--primary-soft) 18%, transparent) 50%, color-mix(in srgb, white 7%, transparent) 58%, transparent 72%, transparent 100%)",
    backgroundSize: "240% 100%",
    mixBlendMode: "screen",
    opacity: 0.78,
  }

  return (
    <section
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden bg-surface-shell",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0" style={atmosphereStyle} />

      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        <div className="flex h-full opacity-95 [backface-visibility:hidden] [transform:translateZ(0)]">
          {Array.from({ length: numBars }).map((_, index) => {
            const style: CSSProperties = {
              animation: `feedme-bar-candy-life ${animationDuration * 1.45}s ease-in-out infinite alternate`,
              animationDelay: `-${(index / numBars) * animationDuration * 1.2}s`,
              background: `linear-gradient(100deg, color-mix(in srgb, white 22%, transparent) 0%, transparent 18%, color-mix(in srgb, var(--surface-shell) 26%, transparent) 56%, color-mix(in srgb, white 10%, transparent) 82%, transparent 100%), radial-gradient(90% 48% at 50% 100%, color-mix(in srgb, var(--primary-soft) 64%, transparent) 0%, transparent 64%), linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
              backgroundPosition: "0% 0%, 50% 100%, 0% 100%",
              backgroundSize: "180% 100%, 125% 100%, 100% 100%",
              boxShadow:
                "inset 1px 0 0 color-mix(in srgb, white 22%, transparent), inset -16px 0 26px color-mix(in srgb, var(--surface-shell) 28%, transparent), inset 0 1px 14px -7px color-mix(in srgb, white 90%, transparent), 0 28px 58px -34px color-mix(in srgb, var(--primary-alt) 88%, transparent)",
              flex: 1,
              height: "100%",
              marginLeft: index === 0 ? 0 : -1,
              willChange: "background-position, filter, opacity",
            }

            return <div aria-hidden="true" className="relative" key={index} style={style} />
          })}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2]"
        style={sharedShimmerStyle}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[58%]"
        style={topArcFadeStyle}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[50%]"
        style={bottomArcFadeStyle}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-[3] w-[38%]"
        style={rightArcFadeStyle}
      />

      <div className="relative z-10 h-full">{children}</div>
    </section>
  )
}
