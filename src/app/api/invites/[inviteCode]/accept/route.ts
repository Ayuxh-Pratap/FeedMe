import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { acceptInvite } from "@/server/invites/service"
import { inviteCodeParamSchema } from "@/server/invites/validation"

export const runtime = "nodejs"

type AcceptInviteRouteContext = {
  params: Promise<{
    inviteCode: string
  }>
}

export async function POST(_request: Request, { params }: AcceptInviteRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { inviteCode } = await params
    const result = await acceptInvite(
      currentSession.user.id,
      inviteCodeParamSchema.parse(inviteCode)
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
