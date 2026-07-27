import { randomUUID } from "node:crypto"

import { and, asc, desc, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  notifications,
  notificationOutbox,
  userProfiles,
  users,
  workspaceMemberships,
} from "@/db/schema"
import {
  formatNotificationCreatedAgo,
  type WorkspaceNotification,
  type WorkspaceNotificationActor,
  type WorkspaceNotificationType,
} from "@/lib/notifications"
import { getNameFromEmail } from "@/lib/team-members"
import { NotFoundError } from "@/server/http/errors"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"
import type {
  ListWorkspaceNotificationsInput,
  MarkWorkspaceNotificationsReadInput,
} from "@/server/notifications/validation"

type NotificationPerson = {
  id: string
  email: string
  fullName: string | null
  displayName: string | null
  avatarUrl: string | null
}

export type CreateWorkspaceNotificationInput = {
  actorUserId?: string | null
  body: string
  commentId?: string | null
  dedupeKey?: string | null
  href: string
  metadata?: Record<string, unknown>
  noteId?: string | null
  recipientUserIds: string[]
  reportId?: string | null
  title: string
  type: WorkspaceNotificationType
  workspaceId: string
}

export type DurableWorkspaceNotificationInput =
  CreateWorkspaceNotificationInput & { dedupeKey: string }

export function buildNotificationOutboxValues(
  input: DurableWorkspaceNotificationInput
): typeof notificationOutbox.$inferInsert | null {
  const recipientUserIds = [
    ...new Set(
      input.recipientUserIds.filter(
        (recipientUserId) =>
          recipientUserId && recipientUserId !== input.actorUserId
      )
    ),
  ]

  if (recipientUserIds.length === 0) {
    return null
  }

  return {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dedupeKey: input.dedupeKey,
    payload: {
      actorUserId: input.actorUserId,
      body: input.body,
      commentId: input.commentId,
      href: input.href,
      metadata: input.metadata,
      noteId: input.noteId,
      recipientUserIds,
      reportId: input.reportId,
      title: input.title,
      type: input.type,
    },
  }
}

function getPersonName(person: NotificationPerson) {
  return (
    person.fullName?.trim() ||
    person.displayName?.trim() ||
    getNameFromEmail(person.email)
  )
}

function serializeNotificationActor(
  person: NotificationPerson | undefined
): WorkspaceNotificationActor {
  if (!person) {
    return null
  }

  return {
    id: person.id,
    name: getPersonName(person),
    email: person.email,
    avatarUrl: person.avatarUrl,
  }
}

async function getNotificationPeopleById(userIds: Array<string | null | undefined>) {
  const compactIds = [...new Set(userIds.filter(Boolean) as string[])]

  if (compactIds.length === 0) {
    return new Map<string, NotificationPerson>()
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: userProfiles.fullName,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(inArray(users.id, compactIds))

  return new Map(rows.map((row) => [row.id, row]))
}

function serializeNotification(
  row: typeof notifications.$inferSelect,
  peopleById: Map<string, NotificationPerson>
): WorkspaceNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    createdAgo: formatNotificationCreatedAgo(row.createdAt),
    actor: serializeNotificationActor(
      row.actorUserId ? peopleById.get(row.actorUserId) : undefined
    ),
    reportId: row.reportId,
    commentId: row.commentId,
    noteId: row.noteId,
  }
}

async function requireWorkspaceForNotificationsRead(
  userId: string,
  workspaceSlug: string
) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "workspace:read")

  return workspace
}

async function getUnreadNotificationCount(workspaceId: string, userId: string) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientUserId, userId),
        isNull(notifications.archivedAt),
        isNull(notifications.readAt)
      )
    )

  return row?.count ?? 0
}

export async function listWorkspaceNotifications(
  userId: string,
  workspaceSlug: string,
  input: ListWorkspaceNotificationsInput
) {
  const workspace = await requireWorkspaceForNotificationsRead(
    userId,
    workspaceSlug
  )
  await processWorkspaceNotificationOutbox(workspace.id)
  const unreadCondition = input.unreadOnly ? isNull(notifications.readAt) : undefined
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.workspaceId, workspace.id),
        eq(notifications.recipientUserId, userId),
        isNull(notifications.archivedAt),
        unreadCondition
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(input.limit)
  const [unreadCount, peopleById] = await Promise.all([
    getUnreadNotificationCount(workspace.id, userId),
    getNotificationPeopleById(rows.map((row) => row.actorUserId)),
  ])

  return {
    notifications: rows.map((row) => serializeNotification(row, peopleById)),
    unreadCount,
  }
}

export async function markWorkspaceNotificationsRead(
  userId: string,
  workspaceSlug: string,
  input: MarkWorkspaceNotificationsReadInput
) {
  const workspace = await requireWorkspaceForNotificationsRead(
    userId,
    workspaceSlug
  )
  const now = new Date()
  const idsCondition = input.notificationIds?.length
    ? inArray(notifications.id, input.notificationIds)
    : undefined

  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.workspaceId, workspace.id),
        eq(notifications.recipientUserId, userId),
        isNull(notifications.archivedAt),
        isNull(notifications.readAt),
        idsCondition
      )
    )

  return listWorkspaceNotifications(userId, workspaceSlug, {
    limit: 20,
    unreadOnly: false,
  })
}

export async function getActiveWorkspaceUserIdsByRoles(
  workspaceId: string,
  roles: Array<typeof workspaceMemberships.$inferSelect.role>,
  excludeUserIds: string[] = []
) {
  const rows = await db
    .select({ userId: workspaceMemberships.userId })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.status, "active"),
        inArray(workspaceMemberships.role, roles),
        excludeUserIds.length > 0
          ? ne(workspaceMemberships.userId, excludeUserIds[0])
          : undefined
      )
    )

  if (excludeUserIds.length <= 1) {
    return rows.map((row) => row.userId)
  }

  const excluded = new Set(excludeUserIds)

  return rows
    .map((row) => row.userId)
    .filter((recipientUserId) => !excluded.has(recipientUserId))
}

export async function createWorkspaceNotifications({
  actorUserId,
  body,
  commentId,
  dedupeKey,
  href,
  metadata,
  noteId,
  recipientUserIds,
  reportId,
  title,
  type,
  workspaceId,
}: CreateWorkspaceNotificationInput) {
  const uniqueRecipientIds = [
    ...new Set(
      recipientUserIds.filter(
        (recipientUserId) => recipientUserId && recipientUserId !== actorUserId
      )
    ),
  ]

  if (uniqueRecipientIds.length === 0) {
    return 0
  }

  await db
    .insert(notifications)
    .values(
      uniqueRecipientIds.map((recipientUserId) => ({
        workspaceId,
        recipientUserId,
        actorUserId: actorUserId ?? null,
        reportId: reportId ?? null,
        commentId: commentId ?? null,
        noteId: noteId ?? null,
        type,
        title,
        body,
        href,
        dedupeKey: dedupeKey ? `${dedupeKey}:${recipientUserId}` : null,
        metadata: metadata ?? {},
      }))
    )
    .onConflictDoNothing({
      target: [
        notifications.workspaceId,
        notifications.recipientUserId,
        notifications.dedupeKey,
      ],
    })

  return uniqueRecipientIds.length
}

export async function enqueueWorkspaceNotification(
  input: DurableWorkspaceNotificationInput
) {
  const values = buildNotificationOutboxValues(input)

  if (!values) {
    return null
  }

  const [event] = await db
    .insert(notificationOutbox)
    .values(values)
    .onConflictDoNothing({
      target: [notificationOutbox.workspaceId, notificationOutbox.dedupeKey],
    })
    .returning({ id: notificationOutbox.id })

  if (event) {
    return event.id
  }

  const [existing] = await db
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.workspaceId, input.workspaceId),
        eq(notificationOutbox.dedupeKey, input.dedupeKey)
      )
    )
    .limit(1)

  return existing?.id ?? null
}

export async function processNotificationOutboxEvent(eventId: string) {
  const [event] = await db
    .select()
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.id, eventId),
        isNull(notificationOutbox.processedAt),
        isNull(notificationOutbox.deadLetteredAt),
        lte(notificationOutbox.availableAt, new Date())
      )
    )
    .limit(1)

  if (!event) {
    return false
  }

  try {
    await createWorkspaceNotifications({
      ...event.payload,
      dedupeKey: event.dedupeKey,
      workspaceId: event.workspaceId,
    })

    await db
      .update(notificationOutbox)
      .set({ processedAt: new Date(), lastError: null })
      .where(eq(notificationOutbox.id, event.id))

    return true
  } catch (error) {
    const attempts = event.attempts + 1
    const deadLettered = attempts >= 8
    const backoffMs = Math.min(15 * 60 * 1000, 2 ** Math.min(attempts, 8) * 1000)
    const errorMessage =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : "Unknown notification delivery error."

    await db
      .update(notificationOutbox)
      .set({
        attempts,
        availableAt: new Date(Date.now() + backoffMs),
        deadLetteredAt: deadLettered ? new Date() : null,
        lastError: errorMessage,
      })
      .where(eq(notificationOutbox.id, event.id))

    if (deadLettered) {
      console.error("notifications.outbox.dead_lettered", {
        eventId: event.id,
        workspaceId: event.workspaceId,
        attempts,
        error: errorMessage,
      })
    }

    return false
  }
}

export async function processWorkspaceNotificationOutbox(
  workspaceId: string,
  limit = 20
) {
  const events = await db
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.workspaceId, workspaceId),
        isNull(notificationOutbox.processedAt),
        isNull(notificationOutbox.deadLetteredAt),
        lte(notificationOutbox.availableAt, new Date())
      )
    )
    .orderBy(asc(notificationOutbox.createdAt), asc(notificationOutbox.id))
    .limit(limit)

  for (const event of events) {
    await processNotificationOutboxEvent(event.id)
  }
}

export async function processPendingNotificationOutbox(limit = 100) {
  const events = await db
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(
      and(
        isNull(notificationOutbox.processedAt),
        isNull(notificationOutbox.deadLetteredAt),
        lte(notificationOutbox.availableAt, new Date())
      )
    )
    .orderBy(asc(notificationOutbox.createdAt), asc(notificationOutbox.id))
    .limit(limit)
  let processed = 0

  for (const event of events) {
    if (await processNotificationOutboxEvent(event.id)) {
      processed += 1
    }
  }

  return { attempted: events.length, processed }
}

export async function getNotificationOutboxHealth() {
  const [row] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${notificationOutbox.processedAt} is null and ${notificationOutbox.deadLetteredAt} is null)::int`.mapWith(Number),
      deadLettered: sql<number>`count(*) filter (where ${notificationOutbox.deadLetteredAt} is not null)::int`.mapWith(Number),
      oldestPendingAt: sql<Date | null>`min(${notificationOutbox.createdAt}) filter (where ${notificationOutbox.processedAt} is null and ${notificationOutbox.deadLetteredAt} is null)`,
    })
    .from(notificationOutbox)

  return row ?? { pending: 0, deadLettered: 0, oldestPendingAt: null }
}
