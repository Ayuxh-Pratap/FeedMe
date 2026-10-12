import { createHash, randomUUID } from "node:crypto"

import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  authActionTokens,
  authEmailOutbox,
  type AuthEmailOutboxPayload,
} from "@/db/schema"
import {
  sendExistingAccountEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/server/auth/emails"

const MAX_AUTH_EMAIL_ATTEMPTS = 8
const AUTH_EMAIL_DELIVERY_LEASE_MS = 60 * 1000

type AuthEmailTemplate = (typeof authEmailOutbox.$inferSelect)["template"]

type BuildAuthEmailOutboxInput = {
  userId: string
  recipientEmail: string
  template: AuthEmailTemplate
  token?: string
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function buildAuthEmailOutboxValues({
  userId,
  recipientEmail,
  template,
  token,
}: BuildAuthEmailOutboxInput): typeof authEmailOutbox.$inferInsert & { id: string } {
  if (template !== "existing_account" && !token) {
    throw new Error(`Auth email template ${template} requires a token.`)
  }

  const id = randomUUID()

  return {
    id,
    userId,
    recipientEmail,
    template,
    dedupeKey:
      template === "existing_account"
        ? `existing-account:${userId}:${id}`
        : `${template}:${tokenDigest(token as string)}`,
    payload: token ? { token } : {},
    availableAt: new Date(),
  }
}

async function deliverAuthEmail(event: typeof authEmailOutbox.$inferSelect) {
  const token = event.payload.token

  if (token) {
    const [activeToken] = await db
      .select({ id: authActionTokens.id })
      .from(authActionTokens)
      .where(
        and(
          eq(authActionTokens.userId, event.userId),
          eq(authActionTokens.tokenHash, tokenDigest(token)),
          isNull(authActionTokens.consumedAt),
          gt(authActionTokens.expiresAt, new Date())
        )
      )
      .limit(1)

    if (!activeToken) return
  }

  switch (event.template) {
    case "email_verification":
      if (!token) throw new Error("Verification email payload is missing its token.")
      await sendVerificationEmail(event.recipientEmail, token)
      return
    case "password_reset":
      if (!token) throw new Error("Password reset email payload is missing its token.")
      await sendPasswordResetEmail(event.recipientEmail, token)
      return
    case "existing_account":
      await sendExistingAccountEmail(event.recipientEmail, event.dedupeKey)
  }
}

export async function enqueueAuthEmail(
  values: typeof authEmailOutbox.$inferInsert
) {
  const [event] = await db
    .insert(authEmailOutbox)
    .values(values)
    .onConflictDoNothing({ target: authEmailOutbox.dedupeKey })
    .returning({ id: authEmailOutbox.id })

  if (event) return event.id

  const [existing] = await db
    .select({ id: authEmailOutbox.id })
    .from(authEmailOutbox)
    .where(eq(authEmailOutbox.dedupeKey, values.dedupeKey))
    .limit(1)

  return existing?.id ?? null
}

export async function processAuthEmailOutboxEvent(eventId: string) {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + AUTH_EMAIL_DELIVERY_LEASE_MS)
  const [event] = await db
    .update(authEmailOutbox)
    .set({ availableAt: leaseUntil, updatedAt: now })
    .where(
      and(
        eq(authEmailOutbox.id, eventId),
        isNull(authEmailOutbox.processedAt),
        isNull(authEmailOutbox.deadLetteredAt),
        lte(authEmailOutbox.availableAt, now)
      )
    )
    .returning()

  if (!event) return false

  try {
    await deliverAuthEmail(event)

    await db
      .update(authEmailOutbox)
      .set({
        processedAt: new Date(),
        lastError: null,
        payload: {} satisfies AuthEmailOutboxPayload,
      })
      .where(eq(authEmailOutbox.id, event.id))

    return true
  } catch (error) {
    const attempts = event.attempts + 1
    const deadLettered = attempts >= MAX_AUTH_EMAIL_ATTEMPTS
    const backoffMs = Math.min(
      15 * 60 * 1000,
      2 ** Math.min(attempts, MAX_AUTH_EMAIL_ATTEMPTS) * 1000
    )
    const errorMessage =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Unknown auth email delivery error."

    await db
      .update(authEmailOutbox)
      .set({
        attempts,
        availableAt: new Date(Date.now() + backoffMs),
        deadLetteredAt: deadLettered ? new Date() : null,
        lastError: errorMessage,
        ...(deadLettered
          ? { payload: {} satisfies AuthEmailOutboxPayload }
          : {}),
      })
      .where(eq(authEmailOutbox.id, event.id))

    console.error(
      deadLettered
        ? "auth.email.outbox_dead_lettered"
        : "auth.email.outbox_delivery_failed",
      {
        eventId: event.id,
        template: event.template,
        attempts,
        error: errorMessage,
      }
    )

    return false
  }
}

export async function processPendingAuthEmailOutbox(limit = 100) {
  const events = await db
    .select({ id: authEmailOutbox.id })
    .from(authEmailOutbox)
    .where(
      and(
        isNull(authEmailOutbox.processedAt),
        isNull(authEmailOutbox.deadLetteredAt),
        lte(authEmailOutbox.availableAt, new Date())
      )
    )
    .orderBy(asc(authEmailOutbox.createdAt), asc(authEmailOutbox.id))
    .limit(limit)
  let processed = 0

  for (const event of events) {
    if (await processAuthEmailOutboxEvent(event.id)) processed += 1
  }

  return { attempted: events.length, processed }
}

export async function getAuthEmailOutboxHealth() {
  const [row] = await db
    .select({
      pending:
        sql<number>`count(*) filter (where ${authEmailOutbox.processedAt} is null and ${authEmailOutbox.deadLetteredAt} is null)::int`.mapWith(
          Number
        ),
      deadLettered:
        sql<number>`count(*) filter (where ${authEmailOutbox.deadLetteredAt} is not null)::int`.mapWith(
          Number
        ),
      oldestPendingAt: sql<Date | null>`min(${authEmailOutbox.createdAt}) filter (where ${authEmailOutbox.processedAt} is null and ${authEmailOutbox.deadLetteredAt} is null)`,
    })
    .from(authEmailOutbox)

  return row ?? { pending: 0, deadLettered: 0, oldestPendingAt: null }
}
