export type WorkspaceMemberRole =
  | "owner"
  | "admin"
  | "developer"
  | "designer"
  | "reporter"
  | "viewer"

export type WorkspaceMemberStatus = "active" | "pending" | "disabled" | "removed"

export const assignableReportRoles = ["developer", "designer"] as const

export type WorkspaceTeamMember = {
  id: string
  userId: string
  name: string
  displayName: string
  email: string
  initials: string
  role: WorkspaceMemberRole
  status: WorkspaceMemberStatus
  title: string | null
  avatarUrl: string | null
  assignedCount: number
  completedCount: number
  reportsCount: number
  joinedAt: string
  joinedAtLabel: string
  createdAt: string
  updatedAt: string
}

const roleLabels: Record<WorkspaceMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  developer: "Developer",
  designer: "Designer",
  reporter: "Reporter",
  viewer: "Viewer",
}

export function getWorkspaceMemberRoleLabel(role: WorkspaceMemberRole) {
  return roleLabels[role]
}

export function isAssignableReportRole(role: WorkspaceMemberRole | null | undefined) {
  if (!role) {
    return false
  }

  return assignableReportRoles.includes(
    role as (typeof assignableReportRoles)[number]
  )
}

export function getNameFromEmail(email: string) {
  return email.split("@")[0] || "Member"
}

export function getInitialsFromName(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")

  return initials || "M"
}

export function formatMemberJoinedAt(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value

  if (Number.isNaN(date.getTime())) {
    return "Unknown"
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}
