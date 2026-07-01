import { and, asc, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { workspaceMemberships, workspaces } from "@/db/schema"

export type WorkspaceSummary = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  role: "owner" | "admin" | "developer" | "designer" | "reporter" | "viewer"
}

export async function getDefaultWorkspaceForUser(
  userId: string
): Promise<WorkspaceSummary | null> {
  const [row] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      logoUrl: workspaces.logoUrl,
      role: workspaceMemberships.role,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(
      and(
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, "active"),
        isNull(workspaces.archivedAt)
      )
    )
    .orderBy(asc(workspaceMemberships.createdAt))
    .limit(1)

  return row ?? null
}

export async function getWorkspaceForUserBySlug(userId: string, workspaceSlug: string) {
  const [row] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      logoUrl: workspaces.logoUrl,
      role: workspaceMemberships.role,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .where(
      and(
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.status, "active"),
        eq(workspaces.slug, workspaceSlug),
        isNull(workspaces.archivedAt)
      )
    )
    .limit(1)

  return row ?? null
}
