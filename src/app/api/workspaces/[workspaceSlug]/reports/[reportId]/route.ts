import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { getWorkspaceReport } from "@/server/reports/service"
import { reportIdParamSchema } from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportRouteContext = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

export async function GET(
  _request: Request,
  { params }: WorkspaceReportRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { reportId, workspaceSlug } = await params
    const result = await getWorkspaceReport(
      currentSession.user.id,
      workspaceSlug,
      reportIdParamSchema.parse(reportId)
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
