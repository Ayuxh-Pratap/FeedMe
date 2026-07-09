import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  listWorkspaceNotifications,
  markWorkspaceNotificationsRead,
} from "@/server/notifications/service"
import {
  listWorkspaceNotificationsInputSchema,
  markWorkspaceNotificationsReadInputSchema,
} from "@/server/notifications/validation"

export const runtime = "nodejs"

type WorkspaceNotificationsRouteContext = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export async function GET(
  request: Request,
  { params }: WorkspaceNotificationsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const url = new URL(request.url)
    const input = listWorkspaceNotificationsInputSchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
    })
    const result = await listWorkspaceNotifications(
      currentSession.user.id,
      workspaceSlug,
      input
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: WorkspaceNotificationsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const input = markWorkspaceNotificationsReadInputSchema.parse(
      await readJson(request)
    )
    const result = await markWorkspaceNotificationsRead(
      currentSession.user.id,
      workspaceSlug,
      input
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
