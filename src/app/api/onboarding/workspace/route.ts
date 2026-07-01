import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { completeWorkspaceOnboarding } from "@/server/onboarding/service"
import { workspaceOnboardingInputSchema } from "@/server/onboarding/validation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const currentSession = await requireCurrentSession()
    const input = workspaceOnboardingInputSchema.parse(await readJson(request))
    const result = await completeWorkspaceOnboarding(currentSession.user.id, input)

    return ok(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
