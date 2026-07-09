import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  createWorkspaceReportComment,
  listWorkspaceReportComments,
} from "@/server/reports/service"
import {
  createReportCommentInputSchema,
  listReportCommentsInputSchema,
  reportIdParamSchema,
} from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportCommentsRouteContext = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

export async function GET(
  request: Request,
  { params }: WorkspaceReportCommentsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { reportId, workspaceSlug } = await params
    const url = new URL(request.url)
    const input = listReportCommentsInputSchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      parentCommentId: url.searchParams.get("parentCommentId") ?? undefined,
    })
    const result = await listWorkspaceReportComments(
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

export async function POST(
  request: Request,
  { params }: WorkspaceReportCommentsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { reportId, workspaceSlug } = await params
    const input = createReportCommentInputSchema.parse(await readJson(request))
    const result = await createWorkspaceReportComment(
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
