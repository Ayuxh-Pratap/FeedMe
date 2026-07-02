import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { assignWorkspaceReport } from "@/server/reports/service"
import {
  assignReportInputSchema,
  reportIdParamSchema,
} from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportAssignmentRouteContext = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

export async function PATCH(
  request: Request,
  { params }: WorkspaceReportAssignmentRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { reportId, workspaceSlug } = await params
    const input = assignReportInputSchema.parse(await readJson(request))
    const result = await assignWorkspaceReport(
      currentSession.user.id,
      workspaceSlug,
      reportIdParamSchema.parse(reportId),
      input
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
