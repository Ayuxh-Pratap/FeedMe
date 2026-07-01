import { and, eq, gt, isNull } from "drizzle-orm"

import { db } from "@/db"
import { sessions, userProfiles, users } from "@/db/schema"
import { UnauthorizedError } from "@/server/http/errors"
import { hashSessionToken, readSessionTokenCookie } from "@/server/auth/sessions"

export type CurrentUser = {
  id: string
  email: string
  emailVerifiedAt: Date | null
  lastLoginAt: Date | null
}

export type CurrentProfile = {
  id: string
  fullName: string
  displayName: string
  title: string | null
  avatarUrl: string | null
  onboardingCompletedAt: Date | null
}

export type CurrentSession = {
  session: {
    id: string
    expiresAt: Date
  }
  user: CurrentUser
  profile: CurrentProfile | null
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const token = await readSessionTokenCookie()

  if (!token) {
    return null
  }

  const [row] = await db
    .select({
      sessionId: sessions.id,
      sessionExpiresAt: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      profileId: userProfiles.id,
      fullName: userProfiles.fullName,
      displayName: userProfiles.displayName,
      title: userProfiles.title,
      avatarUrl: userProfiles.avatarUrl,
      onboardingCompletedAt: userProfiles.onboardingCompletedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1)

  if (!row) {
    return null
  }

  await db
    .update(sessions)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(sessions.id, row.sessionId))

  return {
    session: {
      id: row.sessionId,
      expiresAt: row.sessionExpiresAt,
    },
    user: {
      id: row.userId,
      email: row.email,
      emailVerifiedAt: row.emailVerifiedAt,
      lastLoginAt: row.lastLoginAt,
    },
    profile: row.profileId
      ? {
          id: row.profileId,
          fullName: row.fullName ?? "",
          displayName: row.displayName ?? "",
          title: row.title,
          avatarUrl: row.avatarUrl,
          onboardingCompletedAt: row.onboardingCompletedAt,
        }
      : null,
  }
}

export async function requireCurrentSession() {
  const currentSession = await getCurrentSession()

  if (!currentSession) {
    throw new UnauthorizedError()
  }

  return currentSession
}
