import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  buildInviteJoinPath,
  buildInviteUrl,
  createWorkspaceInvite,
  listWorkspaceInvites,
} from "@/server/invites/service"
import { createInviteInputSchema } from "@/server/invites/validation"
import { assertRateLimit } from "@/server/security/rate-limit"

export const runtime = "nodejs"

type WorkspaceInvitesRouteContext = {
  params: Promise<{
    workspaceSlug: string
  }>
}

function withInviteLinks<TInvite extends { code: string }>(
  request: Request,
  invite: TInvite
) {
  return {
    ...invite,
    joinPath: buildInviteJoinPath(invite.code),
    inviteUrl: buildInviteUrl(request, invite.code),
  }
}

export async function GET(request: Request, { params }: WorkspaceInvitesRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const result = await listWorkspaceInvites(currentSession.user.id, workspaceSlug)

    return ok({
      workspace: result.workspace,
      invites: result.invites.map((invite) => withInviteLinks(request, invite)),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, { params }: WorkspaceInvitesRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    await assertRateLimit({
      key: currentSession.user.id,
      limit: 20,
      scope: "invites.create.user_daily",
      windowMs: 24 * 60 * 60 * 1000,
    })
    const { workspaceSlug } = await params
    const input = createInviteInputSchema.parse(await readJson(request))
    const result = await createWorkspaceInvite(
      currentSession.user.id,
      workspaceSlug,
      input
    )

    return ok(
      {
        workspace: result.workspace,
        invite: withInviteLinks(request, result.invite),
      },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
