import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { listWorkspaceMembers } from "@/server/members/service"

export const runtime = "nodejs"

type WorkspaceMembersRouteContext = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export async function GET(
  _request: Request,
  { params }: WorkspaceMembersRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const result = await listWorkspaceMembers(currentSession.user.id, workspaceSlug)

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
