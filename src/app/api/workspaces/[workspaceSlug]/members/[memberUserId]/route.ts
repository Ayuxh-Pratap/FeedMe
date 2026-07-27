import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { updateWorkspaceMember } from "@/server/members/service"
import {
  memberUserIdParamSchema,
  updateWorkspaceMemberInputSchema,
} from "@/server/members/validation"

export const runtime = "nodejs"

type MemberRouteContext = {
  params: Promise<{ memberUserId: string; workspaceSlug: string }>
}

export async function PATCH(request: Request, { params }: MemberRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { memberUserId, workspaceSlug } = await params
    const parsedMemberUserId = memberUserIdParamSchema.parse(memberUserId)
    const input = updateWorkspaceMemberInputSchema.parse(await readJson(request))
    const result = await updateWorkspaceMember(
      currentSession.user.id,
      workspaceSlug,
      parsedMemberUserId,
      input
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(_request: Request, { params }: MemberRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { memberUserId, workspaceSlug } = await params
    const parsedMemberUserId = memberUserIdParamSchema.parse(memberUserId)
    const result = await updateWorkspaceMember(
      currentSession.user.id,
      workspaceSlug,
      parsedMemberUserId,
      { status: "removed" }
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
