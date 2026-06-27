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

type BarStyle = CSSProperties & {
  "--initial-scale": number
}

function getBarScale(index: number, total: number) {
  const position = total <= 1 ? 0.5 : index / (total - 1)
  const distanceFromCenter = Math.abs(position - 0.5)
  const heightPercentage = Math.pow(distanceFromCenter * 2, 1.5)

  return 0.4 + 0.6 * heightPercentage
}

export function AnimatedBars({
  numBars = 16,
  gradientFrom = "color-mix(in srgb, var(--primary-alt) 68%, transparent)",
  gradientTo = "transparent",
  animationDuration = 4,
  children,
  className,
}: AnimatedBarsProps) {
  return (
    <section
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden bg-surface-shell",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="flex h-full items-end opacity-80 [backface-visibility:hidden] [transform:translateZ(0)]">
          {Array.from({ length: numBars }).map((_, index) => {
            const scale = getBarScale(index, numBars)
            const style: BarStyle = {
              "--initial-scale": scale,
              animation: `feedme-fluid-wave ${animationDuration}s ease-in-out infinite alternate`,
              animationDelay: `-${index * (animationDuration / numBars)}s`,
              background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
              flex: 1,
              height: "100%",
              marginLeft: index === 0 ? 0 : -1,
              transform: `scaleY(${scale})`,
              transformOrigin: "bottom",
            }

            return <div aria-hidden="true" className="relative" key={index} style={style} />
          })}
        </div>
      </div>

      <div className="relative z-10 h-full">{children}</div>
    </section>
  )
}
