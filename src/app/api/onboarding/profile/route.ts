import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  getOnboardingStateForUser,
  upsertUserProfile,
} from "@/server/onboarding/service"
import { profileInputSchema } from "@/server/onboarding/validation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const currentSession = await requireCurrentSession()
    const input = profileInputSchema.parse(await readJson(request))
    const profile = await upsertUserProfile(currentSession.user.id, input)
    const onboarding = await getOnboardingStateForUser(currentSession.user.id)

    return ok({
      profile,
      onboarding,
      nextPath: onboarding.nextPath,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
