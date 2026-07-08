import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { updateWorkspaceReportImplementationBrief } from "@/server/reports/service"
import {
  reportIdParamSchema,
  updateReportImplementationBriefInputSchema,
} from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportImplementationBriefRouteContext = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

export async function PATCH(
  request: Request,
  { params }: WorkspaceReportImplementationBriefRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { reportId, workspaceSlug } = await params
    const input = updateReportImplementationBriefInputSchema.parse(
      await readJson(request)
    )
    const result = await updateWorkspaceReportImplementationBrief(
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
