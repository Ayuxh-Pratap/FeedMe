"use client"

import { useRouter } from "next/navigation"
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react"

import { AuthButton } from "@/components/feedme/auth-ui"

type RouteTransitionButtonProps = {
  children: ReactNode
  className?: string
  href: string
}

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => void
}

function useRouteTransition() {
  const router = useRouter()

  return (href: string) => {
    const transitionDocument = document as TransitionDocument

    if (!transitionDocument.startViewTransition) {
      router.push(href)
      return
    }

    transitionDocument.startViewTransition(() => {
      router.push(href)
    })
  }
}

export function RouteTransitionButton({
  children,
  className,
  href,
}: RouteTransitionButtonProps) {
  const navigate = useRouteTransition()

  const handleClick = () => {
    navigate(href)
  }

  return (
    <AuthButton type="button" className={className} onClick={handleClick}>
      {children}
    </AuthButton>
  )
}

type RouteTransitionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

export function RouteTransitionLink({
  children,
  href,
  onClick,
  target,
  ...props
}: RouteTransitionLinkProps) {
  const navigate = useRouteTransition()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target
    ) {
      return
    }

    event.preventDefault()
    navigate(href)
  }

  return (
    <a href={href} onClick={handleClick} target={target} {...props}>
      {children}
    </a>
  )
}
