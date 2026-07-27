import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { acceptInvite } from "@/server/invites/service"
import { inviteCodeParamSchema } from "@/server/invites/validation"
import { assertRateLimits, getRequestIp } from "@/server/security/rate-limit"

export const runtime = "nodejs"

type AcceptInviteRouteContext = {
  params: Promise<{
    inviteCode: string
  }>
}

export async function POST(request: Request, { params }: AcceptInviteRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    await assertRateLimits([
      { key: currentSession.user.id, limit: 20, scope: "invites.accept.user", windowMs: 60 * 60 * 1000 },
      { key: getRequestIp(request), limit: 50, scope: "invites.accept.ip", windowMs: 60 * 60 * 1000 },
    ])
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
