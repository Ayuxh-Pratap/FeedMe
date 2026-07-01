import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { deleteWorkspaceDomain } from "@/server/workspaces/domain-service"
import { domainIdParamSchema } from "@/server/workspaces/validation"

export const runtime = "nodejs"

type WorkspaceDomainRouteContext = {
  params: Promise<{
    workspaceSlug: string
    domainId: string
  }>
}

export async function DELETE(
  _request: Request,
  { params }: WorkspaceDomainRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug, domainId } = await params
    const result = await deleteWorkspaceDomain(
      currentSession.user.id,
      workspaceSlug,
      domainIdParamSchema.parse(domainId)
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
