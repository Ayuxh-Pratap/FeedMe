import { createHash, randomBytes } from "node:crypto"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { authActionTokens } from "@/db/schema"

export type AuthActionPurpose =
  (typeof authActionTokens.$inferSelect)["purpose"]

const AUTH_ACTION_TOKEN_LIFETIMES: Record<AuthActionPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
}

export function hashAuthActionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function createAuthActionToken(
  userId: string,
  purpose: AuthActionPurpose,
  redirectPath?: string
) {
  const token = randomBytes(32).toString("base64url")
  const now = new Date()
  const expiresAt = new Date(
    now.getTime() + AUTH_ACTION_TOKEN_LIFETIMES[purpose]
  )
  const deletePrevious = db
    .delete(authActionTokens)
    .where(
      and(
        eq(authActionTokens.userId, userId),
        eq(authActionTokens.purpose, purpose),
        isNull(authActionTokens.consumedAt)
      )
    )
  const insertToken = db.insert(authActionTokens).values({
    userId,
    purpose,
    tokenHash: hashAuthActionToken(token),
    redirectPath,
    expiresAt,
  })

  await db.batch([deletePrevious, insertToken])

  return { token, expiresAt }
}
