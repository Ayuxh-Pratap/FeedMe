import { requireCurrentSession } from "@/server/auth/current-user"
import { revokeAccessToken } from "@/server/access-tokens/service"
import { accessTokenIdParamSchema } from "@/server/access-tokens/validation"
import { NotFoundError } from "@/server/http/errors"
import { errorResponse, ok } from "@/server/http/responses"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"

export const runtime = "nodejs"

type TokenRouteContext = {
  params: Promise<{
    workspaceSlug: string
    tokenId: string
  }>
}

export async function DELETE(_request: Request, { params }: TokenRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug, tokenId } = await params
    const workspace = await getWorkspaceForUserBySlug(
      currentSession.user.id,
      workspaceSlug
    )

    if (!workspace) {
      throw new NotFoundError("Workspace not found.")
    }

    const parsedTokenId = accessTokenIdParamSchema.parse(tokenId)
    await revokeAccessToken(parsedTokenId, workspace.id, currentSession.user.id)

    return ok({ revoked: true })
  } catch (error) {
    return errorResponse(error)
  }
}
