import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { listWorkspaceReports } from "@/server/reports/service"

export const runtime = "nodejs"

type WorkspaceReportsRouteContext = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export async function GET(
  _request: Request,
  { params }: WorkspaceReportsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const result = await listWorkspaceReports(currentSession.user.id, workspaceSlug)

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
