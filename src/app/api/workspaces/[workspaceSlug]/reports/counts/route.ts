import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { getWorkspaceReportCounts } from "@/server/reports/service"
import { reportCountsInputSchema } from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportCountsRouteContext = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export async function GET(
  request: Request,
  { params }: WorkspaceReportCountsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const searchParams = new URL(request.url).searchParams
    const input = reportCountsInputSchema.parse(
      Object.fromEntries(searchParams.entries())
    )
    const result = await getWorkspaceReportCounts(
      currentSession.user.id,
      workspaceSlug,
      input
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
