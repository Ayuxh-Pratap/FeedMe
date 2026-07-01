import { requireCurrentSession } from "@/server/auth/current-user"
import { ForbiddenError } from "@/server/http/errors"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { getOnboardingStateForUser } from "@/server/onboarding/service"
import {
  createOwnedWorkspace,
  listWorkspacesForUser,
} from "@/server/workspaces/service"
import { createWorkspaceInputSchema } from "@/server/workspaces/validation"

export const runtime = "nodejs"

export async function GET() {
  try {
    const currentSession = await requireCurrentSession()
    const workspaces = await listWorkspacesForUser(currentSession.user.id)

    return ok({ workspaces })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const currentSession = await requireCurrentSession()
    const onboarding = await getOnboardingStateForUser(currentSession.user.id)

    if (onboarding.nextStep !== "complete") {
      throw new ForbiddenError("Finish onboarding before creating another workspace.")
    }

    const input = createWorkspaceInputSchema.parse(await readJson(request))
    const workspace = await createOwnedWorkspace(currentSession.user.id, input)

    return ok(
      {
        workspace,
        nextPath: `/${workspace.slug}/reports`,
      },
      { status: 201 }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
