import { randomUUID } from "node:crypto"

import { and, asc, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import {
  userProfiles,
  workspaceDomains,
  workspaceMemberships,
  workspaces,
} from "@/db/schema"
import { AppError } from "@/server/http/errors"
import { normalizeDomainHost } from "@/server/workspaces/domains"
import { generateUniqueWorkspaceSlug } from "@/server/workspaces/slugs"
import type { CreateWorkspaceInput } from "@/server/workspaces/validation"

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

export async function listWorkspacesForUser(userId: string) {
  return db
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

export async function createOwnedWorkspace(
  userId: string,
  input: CreateWorkspaceInput,
  options: {
    completeOnboarding?: boolean
  } = {}
) {
  const domainHost = normalizeDomainHost(input.firstDomain)
  const slug = await generateUniqueWorkspaceSlug(input.workspaceName)
  const workspaceId = randomUUID()
  const workspaceInsert = db
    .insert(workspaces)
    .values({
      id: workspaceId,
      name: input.workspaceName,
      slug,
      createdByUserId: userId,
    })
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      logoUrl: workspaces.logoUrl,
    })
  const membershipInsert = db.insert(workspaceMemberships).values({
    workspaceId,
    userId,
    role: "owner",
    status: "active",
  })
  const domainInsert = db.insert(workspaceDomains).values({
    workspaceId,
    host: domainHost,
    status: "active",
    addedByUserId: userId,
  })

  const [createdWorkspaceRows] = options.completeOnboarding
    ? await db.batch([
        workspaceInsert,
        membershipInsert,
        domainInsert,
        db
          .update(userProfiles)
          .set({
            onboardingCompletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.userId, userId)),
      ])
    : await db.batch([workspaceInsert, membershipInsert, domainInsert])

  const workspace = createdWorkspaceRows[0]

  if (!workspace) {
    throw new AppError({
      code: "WORKSPACE_CREATE_FAILED",
      message: "Workspace could not be created. Please try again.",
      status: 500,
    })
  }

  return {
    ...workspace,
    role: "owner" as const,
  }
}
