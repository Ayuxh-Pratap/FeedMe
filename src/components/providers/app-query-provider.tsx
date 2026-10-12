"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

import {
  ApiClientError,
  FEEDME_UNAUTHORIZED_EVENT,
} from "@/lib/api-client"

function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiClientError && [400, 401, 403, 404, 409, 429].includes(error.status)) {
    return false
  }

  return failureCount < 1
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 5 * 60 * 1000,
            refetchOnReconnect: true,
            refetchOnWindowFocus: true,
            retry: shouldRetry,
            staleTime: 30 * 1000,
          },
          mutations: {
            retry: false,
          },
        },
      })
  )

  useEffect(() => {
    function handleUnauthorized(event: Event) {
      const { nextPath } = (event as CustomEvent<{ nextPath?: string }>).detail
      const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""

      router.replace(`/login${next}`)
    }

    window.addEventListener(FEEDME_UNAUTHORIZED_EVENT, handleUnauthorized)
    return () =>
      window.removeEventListener(FEEDME_UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [router])

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
