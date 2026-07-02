import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { updateWorkspaceReportStatus } from "@/server/reports/service"
import {
  reportIdParamSchema,
  updateReportStatusInputSchema,
} from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportStatusRouteContext = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

export async function PATCH(
  request: Request,
  { params }: WorkspaceReportStatusRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { reportId, workspaceSlug } = await params
    const input = updateReportStatusInputSchema.parse(await readJson(request))
    const result = await updateWorkspaceReportStatus(
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
