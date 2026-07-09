import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  deleteWorkspaceReportComment,
  updateWorkspaceReportComment,
} from "@/server/reports/service"
import {
  commentIdParamSchema,
  reportIdParamSchema,
  updateReportCommentInputSchema,
} from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportCommentRouteContext = {
  params: Promise<{
    commentId: string
    reportId: string
    workspaceSlug: string
  }>
}

export async function PATCH(
  request: Request,
  { params }: WorkspaceReportCommentRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { commentId, reportId, workspaceSlug } = await params
    const input = updateReportCommentInputSchema.parse(await readJson(request))
    const result = await updateWorkspaceReportComment(
      currentSession.user.id,
      workspaceSlug,
      reportIdParamSchema.parse(reportId),
      commentIdParamSchema.parse(commentId),
      input
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: WorkspaceReportCommentRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { commentId, reportId, workspaceSlug } = await params
    const result = await deleteWorkspaceReportComment(
      currentSession.user.id,
      workspaceSlug,
      reportIdParamSchema.parse(reportId),
      commentIdParamSchema.parse(commentId)
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
