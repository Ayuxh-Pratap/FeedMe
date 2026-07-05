import { requireCurrentSession } from "@/server/auth/current-user"
import {
  generateAccessToken,
  listAccessTokens,
} from "@/server/access-tokens/service"
import { createAccessTokenSchema } from "@/server/access-tokens/validation"
import { NotFoundError } from "@/server/http/errors"
import { readJson } from "@/server/http/request"
import { errorResponse, ok } from "@/server/http/responses"
import { getWorkspaceForUserBySlug } from "@/server/workspaces/service"

export const runtime = "nodejs"

type TokensRouteContext = {
  params: Promise<{
    workspaceSlug: string
  }>
}

async function requireWorkspace(userId: string, workspaceSlug: string) {
  const workspace = await getWorkspaceForUserBySlug(userId, workspaceSlug)

  if (!workspace) {
    throw new NotFoundError("Workspace not found.")
  }

  return workspace
}

export async function GET(_request: Request, { params }: TokensRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const workspace = await requireWorkspace(currentSession.user.id, workspaceSlug)
    const tokens = await listAccessTokens(workspace.id, currentSession.user.id)

    return ok({ tokens })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, { params }: TokensRouteContext) {
  try {
    const currentSession = await requireCurrentSession()
    const { workspaceSlug } = await params
    const workspace = await requireWorkspace(currentSession.user.id, workspaceSlug)
    const input = createAccessTokenSchema.parse(await readJson(request))
    const { token, record } = await generateAccessToken(
      currentSession.user.id,
      workspace.id,
      input.label
    )

    // The plaintext token is returned exactly once; only its hash is stored.
    return ok({ token, tokenRecord: record }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
