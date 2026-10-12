import { createHash, randomBytes } from "node:crypto"

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

export function buildAuthActionToken(
  userId: string,
  purpose: AuthActionPurpose,
  redirectPath?: string
) {
  const token = randomBytes(32).toString("base64url")
  const now = new Date()
  const expiresAt = new Date(
    now.getTime() + AUTH_ACTION_TOKEN_LIFETIMES[purpose]
  )
  const values: typeof authActionTokens.$inferInsert = {
    userId,
    purpose,
    tokenHash: hashAuthActionToken(token),
    redirectPath,
    expiresAt,
  }

  return { token, expiresAt, values }
}
