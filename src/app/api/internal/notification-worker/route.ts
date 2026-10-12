import { timingSafeEqual } from "node:crypto"

import {
  getAuthEmailOutboxHealth,
  processPendingAuthEmailOutbox,
} from "@/server/auth/email-outbox"
import {
  getNotificationOutboxHealth,
  processPendingNotificationOutbox,
} from "@/server/notifications/service"
import { errorResponse, ok } from "@/server/http/responses"
import { UnauthorizedError } from "@/server/http/errors"
import { pruneExpiredRateLimitBuckets } from "@/server/security/rate-limit"

export const runtime = "nodejs"

function isAuthorized(request: Request) {
  const secret = process.env.INTERNAL_OPERATIONS_SECRET?.trim()
  const authorization = request.headers.get("authorization")

  if (!secret || !authorization?.startsWith("Bearer ")) return false

  const provided = authorization.slice("Bearer ".length)
  const expectedBuffer = Buffer.from(secret)
  const providedBuffer = Buffer.from(provided)

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  )
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) throw new UnauthorizedError()

    const [delivery, authEmailDelivery] = await Promise.all([
      processPendingNotificationOutbox(),
      processPendingAuthEmailOutbox(),
    ])
    const prunedRateLimitBuckets = await pruneExpiredRateLimitBuckets()
    const [health, authEmailHealth] = await Promise.all([
      getNotificationOutboxHealth(),
      getAuthEmailOutboxHealth(),
    ])

    return ok({
      delivery,
      health,
      authEmailDelivery,
      authEmailHealth,
      prunedRateLimitBuckets,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
