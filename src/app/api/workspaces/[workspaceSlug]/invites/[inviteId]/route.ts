import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { revokeWorkspaceInvite } from "@/server/invites/service"
import { inviteIdParamSchema } from "@/server/invites/validation"

export const runtime = "nodejs"

type InviteRouteContext = {
  params: Promise<{ inviteId: string; workspaceSlug: string }>
}

export async function DELETE(_request: Request, { params }: InviteRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { inviteId, workspaceSlug } = await params
    const result = await revokeWorkspaceInvite(
      currentSession.user.id,
      workspaceSlug,
      inviteIdParamSchema.parse(inviteId)
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
