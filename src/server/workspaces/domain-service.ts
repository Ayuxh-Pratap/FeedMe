import { and, asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { workspaceDomains } from "@/db/schema"
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors"
import { assertCanWorkspaceRole } from "@/server/policies/can"
import type { PolicyAction } from "@/server/policies/actions"
import {
  MAX_DOMAINS_PER_WORKSPACE,
  normalizeDomainHost,
} from "@/server/workspaces/domains"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"
import type { AddWorkspaceDomainInput } from "@/server/workspaces/validation"

export type WorkspaceDomainResponse = {
  id: string
  host: string
  status: "active" | "pending_verification" | "verified" | "disabled"
  verifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

async function requireWorkspaceForDomainAction(
  userId: string,
  workspaceSlug: string,
  action: PolicyAction
) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  assertCanWorkspaceRole(workspace.role, action)

  return workspace
}

function selectDomainFields() {
  return {
    id: workspaceDomains.id,
    host: workspaceDomains.host,
    status: workspaceDomains.status,
    verifiedAt: workspaceDomains.verifiedAt,
    createdAt: workspaceDomains.createdAt,
    updatedAt: workspaceDomains.updatedAt,
  }
}

export async function listWorkspaceDomains(userId: string, workspaceSlug: string) {
  const workspace = await requireWorkspaceForDomainAction(
    userId,
    workspaceSlug,
    "workspace:read"
  )
  const domains = await db
    .select(selectDomainFields())
    .from(workspaceDomains)
    .where(eq(workspaceDomains.workspaceId, workspace.id))
    .orderBy(asc(workspaceDomains.createdAt))

  return {
    workspace,
    domains,
  }
}

export async function addWorkspaceDomain(
  userId: string,
  workspaceSlug: string,
  input: AddWorkspaceDomainInput
) {
  const workspace = await requireWorkspaceForDomainAction(
    userId,
    workspaceSlug,
    "workspace:manage_domains"
  )
  const host = normalizeDomainHost(input.domain, "domain")
  const existingDomains = await db
    .select({
      id: workspaceDomains.id,
      host: workspaceDomains.host,
    })
    .from(workspaceDomains)
    .where(eq(workspaceDomains.workspaceId, workspace.id))

  if (existingDomains.some((domain) => domain.host === host)) {
    throw new ConflictError("This domain is already added to the workspace.", {
      domain: ["This domain is already added to the workspace."],
    })
  }

  if (existingDomains.length >= MAX_DOMAINS_PER_WORKSPACE) {
    throw new ValidationError("A workspace can have up to 5 domains.", {
      domain: ["A workspace can have up to 5 domains."],
    })
  }

  const [domain] = await db
    .insert(workspaceDomains)
    .values({
      workspaceId: workspace.id,
      host,
      status: "active",
      addedByUserId: userId,
    })
    .returning(selectDomainFields())

  return {
    workspace,
    domain,
  }
}

export async function deleteWorkspaceDomain(
  userId: string,
  workspaceSlug: string,
  domainId: string
) {
  const workspace = await requireWorkspaceForDomainAction(
    userId,
    workspaceSlug,
    "workspace:manage_domains"
  )
  const [domain] = await db
    .delete(workspaceDomains)
    .where(
      and(
        eq(workspaceDomains.id, domainId),
        eq(workspaceDomains.workspaceId, workspace.id)
      )
    )
    .returning(selectDomainFields())

  if (!domain) {
    throw new NotFoundError("Domain not found.")
  }

  return {
    workspace,
    domain,
  }
}
