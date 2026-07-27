"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

import { ApiClientError } from "@/lib/api-client"

function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiClientError && [400, 401, 403, 404, 409, 429].includes(error.status)) {
    return false
  }

  return failureCount < 1
}

export function AppQueryProvider({ children }: { children: ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
