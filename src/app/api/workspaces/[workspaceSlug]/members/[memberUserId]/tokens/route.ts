import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { revokeWorkspaceMemberTokens } from "@/server/members/service"
import { memberUserIdParamSchema } from "@/server/members/validation"

export const runtime = "nodejs"

type MemberTokensRouteContext = {
  params: Promise<{ memberUserId: string; workspaceSlug: string }>
}

export async function DELETE(
  _request: Request,
  { params }: MemberTokensRouteContext
) {
  try {
    const currentSession = await requireCurrentSession()
    const { memberUserId, workspaceSlug } = await params
    const result = await revokeWorkspaceMemberTokens(
      currentSession.user.id,
      workspaceSlug,
      memberUserIdParamSchema.parse(memberUserId)
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
