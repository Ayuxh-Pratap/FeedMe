import { ForbiddenError } from "@/server/http/errors"
import type { PolicyAction, WorkspaceRole } from "@/server/policies/actions"

const allActions = new Set<PolicyAction>([
  "workspace:read",
  "workspace:update",
  "workspace:manage_domains",
  "workspace:manage_members",
  "workspace:create_invite",
  "report:create",
  "report:read",
  "report:assign",
  "report:update_brief",
  "report:update_status",
  "report:mark_ready_for_review",
  "report:resolve",
  "report:comment",
])

const rolePermissions: Record<WorkspaceRole, ReadonlySet<PolicyAction>> = {
  owner: allActions,
  admin: allActions,
  developer: new Set([
    "workspace:read",
    "report:create",
    "report:read",
    "report:comment",
    "report:update_status",
    "report:mark_ready_for_review",
  ]),
  designer: new Set([
    "workspace:read",
    "report:create",
    "report:read",
    "report:comment",
    "report:update_status",
    "report:mark_ready_for_review",
  ]),
  reporter: new Set([
    "workspace:read",
    "report:create",
    "report:read",
    "report:comment",
  ]),
  viewer: new Set(["workspace:read", "report:create", "report:read"]),
}

export function canWorkspaceRole(role: WorkspaceRole, action: PolicyAction) {
  return rolePermissions[role].has(action)
}

export function assertCanWorkspaceRole(role: WorkspaceRole, action: PolicyAction) {
  if (!canWorkspaceRole(role, action)) {
    throw new ForbiddenError()
  }
}
