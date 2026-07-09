import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { createWorkspaceReportNote } from "@/server/reports/service"
import {
  createReportNoteInputSchema,
  reportIdParamSchema,
} from "@/server/reports/validation"

export const runtime = "nodejs"

type WorkspaceReportNotesRouteContext = {
  params: Promise<{
    reportId: string
    workspaceSlug: string
  }>
}

export async function POST(
  request: Request,
  { params }: WorkspaceReportNotesRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { reportId, workspaceSlug } = await params
    const input = createReportNoteInputSchema.parse(await readJson(request))
    const result = await createWorkspaceReportNote(
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
