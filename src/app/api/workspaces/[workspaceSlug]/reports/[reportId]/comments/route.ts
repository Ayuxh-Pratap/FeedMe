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
import { assertRateLimits, getRequestIp } from "@/server/security/rate-limit"

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
    await assertRateLimits([
      { key: currentSession.user.id, limit: 60, scope: "comments.create.user", windowMs: 60 * 1000 },
      { key: currentSession.user.id, limit: 1_000, scope: "comments.create.user_daily", windowMs: 24 * 60 * 60 * 1000 },
      { key: getRequestIp(request), limit: 2_000, scope: "comments.create.ip_daily", windowMs: 24 * 60 * 60 * 1000 },
    ])
    const { reportId, workspaceSlug } = await params
    const url = new URL(request.url)
    const input = listReportCommentsInputSchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      parentCommentId: url.searchParams.get("parentCommentId") ?? undefined,
      targetCommentId: url.searchParams.get("targetCommentId") ?? undefined,
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
