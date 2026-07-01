import { eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { normalizeEmail } from "@/server/auth/email"
import { hashPassword, verifyPassword } from "@/server/auth/password"
import { createSession } from "@/server/auth/sessions"
import type { LoginInput, SignupInput } from "@/server/auth/validation"
import { ConflictError, UnauthorizedError } from "@/server/http/errors"
import { getPostAuthRedirectPath } from "@/server/onboarding/service"

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
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1)

  return user ?? null
}

export async function signupWithEmail(input: SignupInput) {
  const existingUser = await findUserByEmail(input.email)

  if (existingUser) {
    throw new ConflictError("An account with this email already exists.", {
      email: ["An account with this email already exists."],
    })
  }

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: await hashPassword(input.password),
    })
    .returning({
      id: users.id,
      email: users.email,
    })

  const { token, session } = await createSession(user.id)

  return {
    user,
    sessionToken: token,
    sessionExpiresAt: session.expiresAt,
    nextPath: "/welcome",
  }
}

export async function loginWithEmail(input: LoginInput) {
  const user = await findUserByEmail(input.email)

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new UnauthorizedError("Email or password is incorrect.")
  }

  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
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
