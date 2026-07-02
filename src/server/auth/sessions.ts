import { createHash, randomBytes } from "node:crypto"

import { cookies } from "next/headers"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { sessions } from "@/db/schema"

export const SESSION_COOKIE_NAME = "feedme_session"

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

function getSessionCookieSameSite() {
  return process.env.NODE_ENV === "production" ? "none" : "lax"
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url")
  const tokenHash = hashSessionToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      expiresAt,
      lastUsedAt: new Date(),
    })
    .returning({
      id: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
    })

  return {
    token,
    session,
  }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: getSessionCookieSameSite(),
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: getSessionCookieSameSite(),
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  })
}

export async function readSessionTokenCookie() {
  const cookieStore = await cookies()

  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null
}

export async function revokeSessionToken(token: string) {
  await db
    .update(sessions)
    .set({
      revokedAt: new Date(),
    })
    .where(eq(sessions.tokenHash, hashSessionToken(token)))
}

export async function revokeCurrentSession() {
  const token = await readSessionTokenCookie()

  if (token) {
    await revokeSessionToken(token)
  }

  await clearSessionCookie()
}
