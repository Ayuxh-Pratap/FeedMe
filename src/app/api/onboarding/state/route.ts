import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { getOnboardingStateForUser } from "@/server/onboarding/service"

export const runtime = "nodejs"

export async function GET() {
  try {
    const currentSession = await requireCurrentSession()
    const onboarding = await getOnboardingStateForUser(currentSession.user.id)

    return ok({
      user: currentSession.user,
      profile: currentSession.profile,
      onboarding,
      nextPath: onboarding.nextPath,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
