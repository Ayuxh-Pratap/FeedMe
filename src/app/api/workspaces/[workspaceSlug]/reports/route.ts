import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  createWorkspaceReport,
  listWorkspaceReports,
} from "@/server/reports/service"
import {
  createReportInputSchema,
  listReportsInputSchema,
} from "@/server/reports/validation"
import { assertRateLimits, getRequestIp } from "@/server/security/rate-limit"

export const runtime = "nodejs"

type WorkspaceReportsRouteContext = {
  params: Promise<{
    workspaceSlug: string
  }>
}

export async function GET(
  request: Request,
  { params }: WorkspaceReportsRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    await assertRateLimits([
      { key: currentSession.user.id, limit: 30, scope: "reports.create.user", windowMs: 60 * 1000 },
      { key: currentSession.user.id, limit: 500, scope: "reports.create.user_daily", windowMs: 24 * 60 * 60 * 1000 },
      { key: getRequestIp(request), limit: 1_000, scope: "reports.create.ip_daily", windowMs: 24 * 60 * 60 * 1000 },
    ])
    const { workspaceSlug } = await params
    const searchParams = new URL(request.url).searchParams
    const input = listReportsInputSchema.parse(
      Object.fromEntries(searchParams.entries())
    )
    const result = await listWorkspaceReports(
      currentSession.user.id,
      workspaceSlug,
      input
    )

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
