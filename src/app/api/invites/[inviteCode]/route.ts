import { errorResponse, ok } from "@/server/http/responses"
import { getInvitePreview } from "@/server/invites/service"
import { inviteCodeParamSchema } from "@/server/invites/validation"

export const runtime = "nodejs"

type InviteRouteContext = {
  params: Promise<{
    inviteCode: string
  }>
}

export async function GET(_request: Request, { params }: InviteRouteContext) {
  try {
    const { inviteCode } = await params
    const result = await getInvitePreview(inviteCodeParamSchema.parse(inviteCode))

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
