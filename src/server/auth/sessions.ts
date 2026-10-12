import { createHash, randomBytes } from "node:crypto"

import { cookies } from "next/headers"
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm"

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

export function buildSession(userId: string) {
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  return {
    token,
    expiresAt,
    values: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      lastUsedAt: new Date(),
    },
  }
}

export async function createSession(userId: string) {
  const pendingSession = buildSession(userId)
  const [session] = await db
    .insert(sessions)
    .values(pendingSession.values)
    .returning({
      id: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
    })

  return {
    token: pendingSession.token,
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

export async function listUserSessions(userId: string, currentSessionId: string) {
  const now = new Date()
  const rows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      lastUsedAt: sessions.lastUsedAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      )
    )
    .orderBy(desc(sessions.lastUsedAt), desc(sessions.createdAt))

  return rows.map((session) => ({
    ...session,
    current: session.id === currentSessionId,
  }))
}

export async function revokeUserSession(
  userId: string,
  currentSessionId: string,
  sessionId: string
) {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt)
      )
    )
    .returning({ id: sessions.id })

  return {
    revoked: revoked.length > 0,
    signedOut: sessionId === currentSessionId && revoked.length > 0,
  }
}

export async function revokeOtherUserSessions(
  userId: string,
  currentSessionId: string
) {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.id, currentSessionId),
        isNull(sessions.revokedAt)
      )
    )
    .returning({ id: sessions.id })

  return { revokedCount: revoked.length }
}
