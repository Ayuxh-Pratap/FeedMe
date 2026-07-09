import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  notifications,
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
    return
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
}
