import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { updateWorkspaceReportCommentReaction } from "@/server/reports/service"
import {
  commentIdParamSchema,
  reportIdParamSchema,
  updateReportCommentReactionInputSchema,
} from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportCommentReactionsRouteContext = {
  params: Promise<{
    commentId: string
    reportId: string
    workspaceSlug: string
  }>
}

export async function PUT(
  request: Request,
  { params }: WorkspaceReportCommentReactionsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { commentId, reportId, workspaceSlug } = await params
    const input = updateReportCommentReactionInputSchema.parse(
      await readJson(request)
    )
    const result = await updateWorkspaceReportCommentReaction(
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
