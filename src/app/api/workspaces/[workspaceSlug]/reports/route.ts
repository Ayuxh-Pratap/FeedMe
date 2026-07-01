import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  createWorkspaceReport,
  listWorkspaceReports,
} from "@/server/reports/service"
import { createReportInputSchema } from "@/server/reports/validation"

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

export async function POST(
  request: Request,
  { params }: WorkspaceReportsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const input = createReportInputSchema.parse(await readJson(request))
    const result = await createWorkspaceReport(
      currentSession.user.id,
      workspaceSlug,
      input
    )

    return ok(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
