import { changePassword } from "@/server/auth/service"
import { requireCurrentSession } from "@/server/auth/current-user"
import { changePasswordInputSchema } from "@/server/auth/validation"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { assertRateLimit } from "@/server/security/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const currentSession = await requireCurrentSession()
    await assertRateLimit({
      key: currentSession.user.id,
      limit: 5,
      scope: "auth.password_change.user",
      windowMs: 60 * 60 * 1000,
    })
    const input = changePasswordInputSchema.parse(await readJson(request))

    await changePassword(
      currentSession.user.id,
      currentSession.session.id,
      input
    )

    return ok({ message: "Password updated. Other sessions have been signed out." })
  } catch (error) {
    return errorResponse(error)
  }
}
