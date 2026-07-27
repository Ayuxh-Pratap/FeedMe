import { and, eq, gt, isNull, ne, sql } from "drizzle-orm"

import { db } from "@/db"
import { authActionTokens, sessions, users } from "@/db/schema"
import {
  createAuthActionToken,
  hashAuthActionToken,
} from "@/server/auth/action-tokens"
import { normalizeEmail } from "@/server/auth/email"
import {
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPassword,
} from "@/server/auth/password"
import { createSession } from "@/server/auth/sessions"
import type {
  ChangePasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from "@/server/auth/validation"
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/server/http/errors"
import { getPostAuthRedirectPath } from "@/server/onboarding/service"
import {
  sendExistingAccountEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/server/auth/emails"

const DUMMY_PASSWORD_HASH =
  "scrypt$131072$8$1$feedme-auth-dummy-salt-v2$dF-0vcGORjDFsHHxKyDMlhmNKkPfawSceyzC6GrviKkIWLyag5LCzSSd348WOUYruN2iKSLblxiWrZm4oLzC4w"

export type AuthenticatedUser = {
  id: string
  email: string
}

async function findUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1)

  return user ?? null
}

export async function signupWithEmail(input: SignupInput) {
  const [existingUser, requestedPasswordHash] = await Promise.all([
    findUserByEmail(input.email),
    hashPassword(input.password),
  ])
  let user = existingUser
  let createdAccount = false

  if (!user) {
    try {
      const [createdUser] = await db
        .insert(users)
        .values({
          email: input.email,
          passwordHash: requestedPasswordHash,
        })
        .returning({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          emailVerifiedAt: users.emailVerifiedAt,
        })

      user = createdUser ?? null
      createdAccount = Boolean(createdUser)
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") {
        throw error
      }

      user = await findUserByEmail(input.email)
    }
  }

  if (!user) {
    throw new Error("Account creation did not return a user.")
  }

  if (!user.emailVerifiedAt && !createdAccount) {
    await db
      .update(users)
      .set({ passwordHash: requestedPasswordHash, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), isNull(users.emailVerifiedAt)))
  }

  if (user.emailVerifiedAt) {
    await sendExistingAccountEmail(user.email)
  } else {
    const { token } = await createAuthActionToken(
      user.id,
      "email_verification",
      input.nextPath
    )
    await sendVerificationEmail(user.email, token)
  }

  return {
    nextPath: "/check-email",
  }
}

export async function loginWithEmail(input: LoginInput) {
  const user = await findUserByEmail(input.email)
  const passwordMatches = await verifyPassword(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  )

  if (
    user &&
    !passwordMatches &&
    passwordHashNeedsUpgrade(user.passwordHash)
  ) {
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH)
  }

  if (!user || !passwordMatches) {
    throw new UnauthorizedError("Email or password is incorrect.")
  }

  if (!user.emailVerifiedAt) {
    const { token } = await createAuthActionToken(
      user.id,
      "email_verification"
    )
    await sendVerificationEmail(user.email, token)
    throw new ForbiddenError(
      "Verify your email before signing in. We sent you a new verification link."
    )
  }

  const upgradedPasswordHash = passwordHashNeedsUpgrade(user.passwordHash)
    ? await hashPassword(input.password)
    : null

  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      ...(upgradedPasswordHash ? { passwordHash: upgradedPasswordHash } : {}),
    })
    .where(eq(users.id, user.id))

  const { token, session } = await createSession(user.id)

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    sessionToken: token,
    sessionExpiresAt: session.expiresAt,
    nextPath: await getPostAuthRedirectPath(user.id),
  }
}

export async function resendVerificationEmail(email: string, nextPath?: string) {
  const user = await findUserByEmail(email)

  if (user && !user.emailVerifiedAt) {
    const { token } = await createAuthActionToken(
      user.id,
      "email_verification",
      nextPath
    )
    await sendVerificationEmail(user.email, token)
  }
}

export async function verifyEmailAddress(token: string) {
  const tokenHash = hashAuthActionToken(token)
  const now = new Date()
  const result = await db.execute<{
    id: string
    email: string
    redirectPath: string | null
  }>(sql`
    WITH consumed_token AS (
      UPDATE ${authActionTokens}
      SET "consumed_at" = ${now}
      WHERE "token_hash" = ${tokenHash}
        AND "purpose" = 'email_verification'::auth_action_token_purpose
        AND "consumed_at" IS NULL
        AND "expires_at" > ${now}
      RETURNING "user_id", "redirect_path"
    )
    UPDATE ${users}
    SET
      "email_verified_at" = COALESCE("email_verified_at", ${now}),
      "updated_at" = ${now}
    FROM consumed_token
    WHERE ${users.id} = consumed_token."user_id"
    RETURNING
      ${users.id} AS "id",
      ${users.email} AS "email",
      consumed_token."redirect_path" AS "redirectPath"
  `)
  const user = result.rows[0]

  if (!user) {
    throw new ValidationError(
      "This verification link is invalid or has expired. Request a new one."
    )
  }

  const { token: sessionToken, session } = await createSession(user.id)

  return {
    user,
    sessionToken,
    sessionExpiresAt: session.expiresAt,
    nextPath: user.redirectPath ?? (await getPostAuthRedirectPath(user.id)),
  }
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email)

  if (user?.emailVerifiedAt) {
    const { token } = await createAuthActionToken(user.id, "password_reset")
    await sendPasswordResetEmail(user.email, token)
  }
}

export async function resetPassword(input: ResetPasswordInput) {
  const passwordHash = await hashPassword(input.password)
  const tokenHash = hashAuthActionToken(input.token)
  const now = new Date()
  const result = await db.execute<{ id: string; email: string }>(sql`
    WITH consumed_token AS (
      UPDATE ${authActionTokens}
      SET "consumed_at" = ${now}
      WHERE "token_hash" = ${tokenHash}
        AND "purpose" = 'password_reset'::auth_action_token_purpose
        AND "consumed_at" IS NULL
        AND "expires_at" > ${now}
      RETURNING "user_id"
    ), updated_user AS (
      UPDATE ${users}
      SET "password_hash" = ${passwordHash}, "updated_at" = ${now}
      FROM consumed_token
      WHERE ${users.id} = consumed_token."user_id"
      RETURNING ${users.id} AS "id", ${users.email} AS "email"
    ), revoked_sessions AS (
      UPDATE ${sessions}
      SET "revoked_at" = ${now}
      WHERE "user_id" IN (SELECT "id" FROM updated_user)
        AND "revoked_at" IS NULL
    )
    SELECT "id", "email" FROM updated_user
  `)
  const user = result.rows[0]

  if (!user) {
    throw new ValidationError(
      "This password reset link is invalid or has expired. Request a new one."
    )
  }

  const { token: sessionToken, session } = await createSession(user.id)

  return {
    user,
    sessionToken,
    sessionExpiresAt: session.expiresAt,
    nextPath: await getPostAuthRedirectPath(user.id),
  }
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: ChangePasswordInput
) {
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new UnauthorizedError("Current password is incorrect.")
  }

  const passwordHash = await hashPassword(input.password)
  const now = new Date()

  await db.batch([
    db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, userId)),
    db
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.userId, userId),
          ne(sessions.id, currentSessionId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now)
        )
      ),
  ])
}
