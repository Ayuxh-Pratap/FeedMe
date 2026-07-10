import { formatReportCapturedAgo } from "@/lib/reports"

export type WorkspaceNotificationType =
  | "report_assigned"
  | "comment_reply"
  | "comment_mention"
  | "admin_comment_added"
  | "clarification_requested"
  | "clarification_added"
  | "blocker_added"
  | "ready_for_review"
  | "report_resolved"

export type WorkspaceNotificationActor = {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
} | null

export type WorkspaceNotification = {
  id: string
  type: WorkspaceNotificationType
  title: string
  body: string
  href: string
  readAt?: string | null
  createdAt: string
  createdAgo: string
  actor: WorkspaceNotificationActor
  reportId?: string | null
  commentId?: string | null
  noteId?: string | null
}

export type WorkspaceNotificationsResponse = {
  notifications: WorkspaceNotification[]
  unreadCount: number
}

export type MarkWorkspaceNotificationsReadResponse = WorkspaceNotificationsResponse

export function formatNotificationCreatedAgo(createdAt: Date) {
  return formatReportCapturedAgo(createdAt)
}
