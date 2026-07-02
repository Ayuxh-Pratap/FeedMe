import { and, asc, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import {
  workspaceDomains,
  workspaceMemberships,
  workspaces,
} from "@/db/schema"
import type { CurrentSession } from "@/server/auth/current-user"
import { canWorkspaceRole } from "@/server/policies/can"

type ExtensionDomainStatus =
  | "active"
  | "pending_verification"
  | "verified"
  | "disabled"

type ExtensionWorkspaceRole =
  | "owner"
  | "admin"
  | "developer"
  | "designer"
  | "reporter"
  | "viewer"

type ExtensionWorkspaceDomain = {
  id: string
  host: string
  status: ExtensionDomainStatus
  captureEnabled: boolean
  permissionPattern: string
  verifiedAt: Date | null
}

type ExtensionWorkspace = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  role: ExtensionWorkspaceRole
  isDefault: boolean
  permissions: {
    canCreateReports: boolean
  }
  domains: ExtensionWorkspaceDomain[]
}

type ExtensionBootstrap = {
  user: {
    id: string
    email: string
    displayName: string
    fullName: string | null
    title: string | null
    avatarUrl: string | null
  }
  activeWorkspaceSlug: string | null
  workspaces: ExtensionWorkspace[]
}

function isCaptureEnabledDomain(status: ExtensionDomainStatus) {
  return status === "active" || status === "verified"
}

function getHostPermissionPattern(host: string) {
  return `https://${host}/*`
}

export async function getExtensionBootstrap(
  currentSession: CurrentSession
): Promise<ExtensionBootstrap> {
  const rows = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      workspaceLogoUrl: workspaces.logoUrl,
      workspaceRole: workspaceMemberships.role,
      domainId: workspaceDomains.id,
      domainHost: workspaceDomains.host,
      domainStatus: workspaceDomains.status,
      domainVerifiedAt: workspaceDomains.verifiedAt,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMemberships.workspaceId))
    .leftJoin(
      workspaceDomains,
      eq(workspaceDomains.workspaceId, workspaceMemberships.workspaceId)
    )
    .where(
      and(
        eq(workspaceMemberships.userId, currentSession.user.id),
        eq(workspaceMemberships.status, "active"),
        isNull(workspaces.archivedAt)
      )
    )
    .orderBy(asc(workspaceMemberships.createdAt), asc(workspaceDomains.createdAt))

  const workspacesById = new Map<string, ExtensionWorkspace>()

  for (const row of rows) {
    let workspace = workspacesById.get(row.workspaceId)

    if (!workspace) {
      workspace = {
        id: row.workspaceId,
        name: row.workspaceName,
        slug: row.workspaceSlug,
        logoUrl: row.workspaceLogoUrl,
        role: row.workspaceRole,
        isDefault: workspacesById.size === 0,
        permissions: {
          canCreateReports: canWorkspaceRole(row.workspaceRole, "report:create"),
        },
        domains: [],
      }
      workspacesById.set(row.workspaceId, workspace)
    }

    if (row.domainId && row.domainHost && row.domainStatus) {
      workspace.domains.push({
        id: row.domainId,
        host: row.domainHost,
        status: row.domainStatus,
        captureEnabled: isCaptureEnabledDomain(row.domainStatus),
        permissionPattern: getHostPermissionPattern(row.domainHost),
        verifiedAt: row.domainVerifiedAt,
      })
    }
  }

  const bootstrapWorkspaces = Array.from(workspacesById.values())

  return {
    user: {
      id: currentSession.user.id,
      email: currentSession.user.email,
      displayName:
        currentSession.profile?.displayName ?? currentSession.user.email.split("@")[0],
      fullName: currentSession.profile?.fullName ?? null,
      title: currentSession.profile?.title ?? null,
      avatarUrl: currentSession.profile?.avatarUrl ?? null,
    },
    activeWorkspaceSlug: bootstrapWorkspaces[0]?.slug ?? null,
    workspaces: bootstrapWorkspaces,
  }
}
