import { NextResponse, type NextRequest } from "next/server"

import {
  FEEDME_CLIENT_HEADER,
  FEEDME_DASHBOARD_CLIENT,
  FEEDME_EXTENSION_CLIENT,
} from "@/lib/api-trust"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const EXTENSION_ORIGIN_PROTOCOLS = new Set([
  "chrome-extension:",
  "moz-extension:",
  "safari-web-extension:",
])

const DEFAULT_TRUSTED_DASHBOARD_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://meefeed.vercel.app",
]

export function proxy(request: NextRequest) {
  if (SAFE_METHODS.has(request.method) || request.nextUrl.pathname.startsWith("/api/mcp")) {
    return NextResponse.next()
  }

  if (isTrustedMutationRequest(request)) {
    return NextResponse.next()
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "This request could not be verified.",
      },
    },
    { status: 403 }
  )
}

export const config = {
  matcher: "/api/:path*",
}

function isTrustedMutationRequest(request: NextRequest) {
  const client = request.headers.get(FEEDME_CLIENT_HEADER)?.trim().toLowerCase()

  if (client === FEEDME_DASHBOARD_CLIENT) {
    return isTrustedDashboardMutation(request)
  }

  if (client === FEEDME_EXTENSION_CLIENT) {
    return isTrustedExtensionMutation(request)
  }

  return false
}

function isTrustedDashboardMutation(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase()

  if (fetchSite === "cross-site") {
    return false
  }

  const origin = request.headers.get("origin")

  if (!origin) {
    return fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none"
  }

  const normalizedOrigin = normalizeOrigin(origin)

  return Boolean(normalizedOrigin && getTrustedDashboardOrigins(request).has(normalizedOrigin))
}

function isTrustedExtensionMutation(request: NextRequest) {
  const origin = request.headers.get("origin")

  if (!origin || origin === "null") {
    return true
  }

  try {
    return EXTENSION_ORIGIN_PROTOCOLS.has(new URL(origin).protocol)
  } catch {
    return false
  }
}

function getTrustedDashboardOrigins(request: NextRequest) {
  return new Set(
    [
      new URL(request.url).origin,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      ...DEFAULT_TRUSTED_DASHBOARD_ORIGINS,
    ]
      .map(normalizeOrigin)
      .filter((origin): origin is string => Boolean(origin))
  )
}

function normalizeOrigin(value: string | undefined | null) {
  if (!value?.trim()) {
    return null
  }

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}
