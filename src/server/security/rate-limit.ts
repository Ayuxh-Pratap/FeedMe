import { createHash } from "node:crypto"

import { lt, sql } from "drizzle-orm"

import { db } from "@/db"
import { rateLimitBuckets } from "@/db/schema"
import { RateLimitError } from "@/server/http/errors"

type RateLimitRule = {
  cost?: number
  key: string
  limit: number
  scope: string
  windowMs: number
}

type RateLimitRow = {
  hit_count: number | string
  window_expires_at: Date | string
}

function hashRateLimitKey(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const forwardedIp = forwardedFor?.split(",")[0]?.trim()

  return (
    forwardedIp ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

export async function assertRateLimit({
  cost = 1,
  key,
  limit,
  scope,
  windowMs,
}: RateLimitRule) {
  const safeCost = Math.max(1, Math.floor(cost))
  const now = new Date()
  const nextWindowExpiresAt = new Date(now.getTime() + windowMs)
  const keyHash = hashRateLimitKey(key)
  const result = await db.execute<RateLimitRow>(sql`
    INSERT INTO ${rateLimitBuckets} (
      "scope",
      "key_hash",
      "hit_count",
      "window_started_at",
      "window_expires_at"
    )
    VALUES (${scope}, ${keyHash}, ${safeCost}, ${now}, ${nextWindowExpiresAt})
    ON CONFLICT ("scope", "key_hash") DO UPDATE
    SET
      "hit_count" = CASE
        WHEN ${rateLimitBuckets.windowExpiresAt} <= ${now} THEN ${safeCost}
        ELSE ${rateLimitBuckets.hitCount} + ${safeCost}
      END,
      "window_started_at" = CASE
        WHEN ${rateLimitBuckets.windowExpiresAt} <= ${now} THEN ${now}
        ELSE ${rateLimitBuckets.windowStartedAt}
      END,
      "window_expires_at" = CASE
        WHEN ${rateLimitBuckets.windowExpiresAt} <= ${now} THEN ${nextWindowExpiresAt}
        ELSE ${rateLimitBuckets.windowExpiresAt}
      END,
      "updated_at" = ${now}
    RETURNING "hit_count", "window_expires_at"
  `)
  const row = result.rows[0]

  if (!row) {
    throw new Error("Rate limit state could not be recorded.")
  }

  const hitCount = Number(row.hit_count)

  if (hitCount === Math.max(1, Math.ceil(limit * 0.8))) {
    console.warn("security.rate_limit.near_capacity", {
      scope,
      keyHash: keyHash.slice(0, 12),
      hitCount,
      limit,
    })
  }

  if (hitCount > limit) {
    const expiresAt = new Date(row.window_expires_at)
    console.warn("security.rate_limit.blocked", {
      scope,
      keyHash: keyHash.slice(0, 12),
      hitCount,
      limit,
    })
    throw new RateLimitError((expiresAt.getTime() - now.getTime()) / 1000)
  }
}

export async function assertRateLimits(rules: RateLimitRule[]) {
  for (const rule of rules) {
    await assertRateLimit(rule)
  }
}

export function rateLimitKey(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim().toLowerCase() || "unknown").join(":")
}

export async function pruneExpiredRateLimitBuckets() {
  const removed = await db
    .delete(rateLimitBuckets)
    .where(lt(rateLimitBuckets.windowExpiresAt, new Date()))
    .returning({ id: rateLimitBuckets.id })

  return removed.length
}
