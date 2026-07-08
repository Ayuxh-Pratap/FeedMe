export const policyActions = [
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
] as const

export type PolicyAction = (typeof policyActions)[number]

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "developer"
  | "designer"
  | "reporter"
  | "viewer"
