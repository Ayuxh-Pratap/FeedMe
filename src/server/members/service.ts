import { and, asc, eq, ne, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  reports,
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
import { NotFoundError } from "@/server/http/errors"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"

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
