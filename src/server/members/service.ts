import { and, asc, eq, isNull, ne, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  reports,
  personalAccessTokens,
  userProfiles,
  users,
  workspaceMemberships,
} from "@/db/schema"
import {
  formatMemberJoinedAt,
  getInitialsFromName,
  getNameFromEmail,
  type WorkspaceTeamMember,
} from "@/lib/team-members"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/http/errors"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"
import type { UpdateWorkspaceMemberInput } from "@/server/members/validation"

function countAssignedReportsSql() {
  return sql<number>`(
    select count(*)::int
    from ${reports}
    where ${reports.workspaceId} = ${workspaceMemberships.workspaceId}
      and ${reports.assigneeUserId} = ${workspaceMemberships.userId}
      and ${reports.status} in ('assigned', 'in_progress', 'ready_for_review')
      and ${reports.archivedAt} is null
  )`.mapWith(Number)
}

function countCompletedReportsSql() {
  return sql<number>`(
    select count(*)::int
    from ${reports}
    where ${reports.workspaceId} = ${workspaceMemberships.workspaceId}
      and ${reports.assigneeUserId} = ${workspaceMemberships.userId}
      and ${reports.status} = 'resolved'
      and ${reports.archivedAt} is null
  )`.mapWith(Number)
}

function countSubmittedReportsSql() {
  return sql<number>`(
    select count(*)::int
    from ${reports}
    where ${reports.workspaceId} = ${workspaceMemberships.workspaceId}
      and ${reports.reporterUserId} = ${workspaceMemberships.userId}
      and ${reports.archivedAt} is null
  )`.mapWith(Number)
}

function serializeMember(row: {
  id: string
  userId: string
  email: string
  fullName: string | null
  displayName: string | null
  title: string | null
  avatarUrl: string | null
  role: WorkspaceTeamMember["role"]
  status: WorkspaceTeamMember["status"]
  assignedCount: number
  completedCount: number
  reportsCount: number
  joinedAt: Date
  createdAt: Date
  updatedAt: Date
}): WorkspaceTeamMember {
  const fallbackName = getNameFromEmail(row.email)
  const name = row.fullName?.trim() || row.displayName?.trim() || fallbackName
  const displayName = row.displayName?.trim() || name

  return {
    id: row.id,
    userId: row.userId,
    name,
    displayName,
    email: row.email,
    initials: getInitialsFromName(displayName || name),
    role: row.role,
    status: row.status,
    title: row.title,
    avatarUrl: row.avatarUrl,
    assignedCount: row.assignedCount,
    completedCount: row.completedCount,
    reportsCount: row.reportsCount,
    joinedAt: row.joinedAt.toISOString(),
    joinedAtLabel: formatMemberJoinedAt(row.joinedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function requireWorkspaceForMembersRead(userId: string, workspaceSlug: string) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "workspace:read")

  return workspace
}

export async function getWorkspaceMemberCount(workspaceId: string) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        ne(workspaceMemberships.status, "removed")
      )
    )

  return row?.count ?? 0
}

export async function listWorkspaceMembers(userId: string, workspaceSlug: string) {
  const workspace = await requireWorkspaceForMembersRead(userId, workspaceSlug)
  const members = await db
    .select({
      id: workspaceMemberships.id,
      userId: workspaceMemberships.userId,
      email: users.email,
      fullName: userProfiles.fullName,
      displayName: userProfiles.displayName,
      title: userProfiles.title,
      avatarUrl: userProfiles.avatarUrl,
      role: workspaceMemberships.role,
      status: workspaceMemberships.status,
      assignedCount: countAssignedReportsSql(),
      completedCount: countCompletedReportsSql(),
      reportsCount: countSubmittedReportsSql(),
      joinedAt: workspaceMemberships.joinedAt,
      createdAt: workspaceMemberships.createdAt,
      updatedAt: workspaceMemberships.updatedAt,
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(users.id, workspaceMemberships.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspace.id),
        ne(workspaceMemberships.status, "removed")
      )
    )
    .orderBy(asc(workspaceMemberships.joinedAt), asc(users.email))

  return {
    workspace,
    members: members.map(serializeMember),
  }
}

async function requireWorkspaceForMemberManagement(
  userId: string,
  workspaceSlug: string
) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, "workspace:manage_members")

  return workspace
}

async function getManagedMembership(workspaceId: string, memberUserId: string) {
  const [membership] = await db
    .select({
      id: workspaceMemberships.id,
      role: workspaceMemberships.role,
      status: workspaceMemberships.status,
      userId: workspaceMemberships.userId,
    })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, memberUserId),
        ne(workspaceMemberships.status, "removed")
      )
    )
    .limit(1)

  if (!membership) {
    throw new NotFoundError("Workspace member not found.")
  }

  return membership
}

function assertCanManageMembership({
  actorRole,
  actorUserId,
  targetRole,
  targetUserId,
}: {
  actorRole: "owner" | "admin"
  actorUserId: string
  targetRole: WorkspaceTeamMember["role"]
  targetUserId: string
}) {
  if (targetRole === "owner") {
    throw new ForbiddenError("The workspace owner cannot be modified.")
  }

  if (actorUserId === targetUserId) {
    throw new ForbiddenError("Use account settings to change your own access.")
  }

  if (actorRole === "admin" && targetRole === "admin") {
    throw new ForbiddenError("Only the workspace owner can manage administrators.")
  }
}

export async function updateWorkspaceMember(
  actorUserId: string,
  workspaceSlug: string,
  memberUserId: string,
  input: UpdateWorkspaceMemberInput
) {
  const workspace = await requireWorkspaceForMemberManagement(
    actorUserId,
    workspaceSlug
  )
  const membership = await getManagedMembership(workspace.id, memberUserId)

  assertCanManageMembership({
    actorRole: workspace.role as "owner" | "admin",
    actorUserId,
    targetRole: membership.role,
    targetUserId: memberUserId,
  })

  const nextRole = input.role ?? membership.role
  const nextStatus = input.status ?? membership.status

  if (workspace.role === "admin" && nextRole === "admin") {
    throw new ForbiddenError("Only the workspace owner can grant administrator access.")
  }

  const releaseAssignments =
    nextStatus !== "active" ||
    (nextRole !== "developer" && nextRole !== "designer")
  const now = new Date()
  const result = await db.execute<{ membership_id: string }>(sql`
    WITH updated_membership AS (
      UPDATE ${workspaceMemberships}
      SET
        "role" = CAST(${nextRole} AS workspace_role),
        "status" = CAST(${nextStatus} AS membership_status),
        "updated_at" = ${now}
      WHERE "workspace_id" = ${workspace.id}
        AND "user_id" = ${memberUserId}
        AND "role" = CAST(${membership.role} AS workspace_role)
        AND "status" = CAST(${membership.status} AS membership_status)
        AND "role" <> 'owner'::workspace_role
      RETURNING "id"
    ),
    assignment_candidates AS (
      SELECT "id", "status" AS "from_status"
      FROM ${reports}
      WHERE ${releaseAssignments}
        AND "workspace_id" = ${workspace.id}
        AND "assignee_user_id" = ${memberUserId}
        AND "status" IN (
          'assigned'::report_status,
          'in_progress'::report_status,
          'ready_for_review'::report_status
        )
        AND "archived_at" IS NULL
        AND EXISTS (SELECT 1 FROM updated_membership)
      FOR UPDATE
    ),
    released_reports AS (
      UPDATE ${reports} AS target
      SET
        "assignee_user_id" = NULL,
        "status" = 'reviewing'::report_status,
        "resolved_at" = NULL,
        "updated_at" = ${now}
      FROM assignment_candidates AS candidate
      WHERE target."id" = candidate."id"
      RETURNING target."id", candidate."from_status"
    ),
    inserted_events AS (
      INSERT INTO report_status_events (
        "id",
        "workspace_id",
        "report_id",
        "actor_user_id",
        "from_status",
        "to_status",
        "note"
      )
      SELECT
        gen_random_uuid(),
        ${workspace.id},
        "id",
        ${actorUserId},
        "from_status",
        'reviewing'::report_status,
        'Assignment released because workspace access changed.'
      FROM released_reports
    ),
    revoked_tokens AS (
      UPDATE ${personalAccessTokens}
      SET "revoked_at" = ${now}
      WHERE "workspace_id" = ${workspace.id}
        AND "user_id" = ${memberUserId}
        AND "revoked_at" IS NULL
        AND ${nextStatus !== "active"}
        AND EXISTS (SELECT 1 FROM updated_membership)
    )
    SELECT "id" AS "membership_id" FROM updated_membership
  `)

  if (!result.rows[0]) {
    throw new ConflictError(
      "This member changed before the update was applied. Refresh and try again."
    )
  }

  return listWorkspaceMembers(actorUserId, workspaceSlug)
}

export async function revokeWorkspaceMemberTokens(
  actorUserId: string,
  workspaceSlug: string,
  memberUserId: string
) {
  const workspace = await requireWorkspaceForMemberManagement(
    actorUserId,
    workspaceSlug
  )
  const membership = await getManagedMembership(workspace.id, memberUserId)

  assertCanManageMembership({
    actorRole: workspace.role as "owner" | "admin",
    actorUserId,
    targetRole: membership.role,
    targetUserId: memberUserId,
  })

  const revoked = await db
    .update(personalAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(personalAccessTokens.workspaceId, workspace.id),
        eq(personalAccessTokens.userId, memberUserId),
        isNull(personalAccessTokens.revokedAt)
      )
    )
    .returning({ id: personalAccessTokens.id })

  return { revokedCount: revoked.length }
}
