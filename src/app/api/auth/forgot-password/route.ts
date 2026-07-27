import { requestPasswordReset } from "@/server/auth/service"
import { requestAuthEmailInputSchema } from "@/server/auth/validation"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { assertRateLimits, getRequestIp } from "@/server/security/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const input = requestAuthEmailInputSchema.parse(await readJson(request))

    await assertRateLimits([
      { key: getRequestIp(request), limit: 10, scope: "auth.password_reset_request.ip", windowMs: 60 * 60 * 1000 },
      { key: input.email, limit: 4, scope: "auth.password_reset_request.email", windowMs: 60 * 60 * 1000 },
    ])

    await requestPasswordReset(input.email)

    return ok({ message: "If an account exists for that email, a reset link is on its way." })
  } catch (error) {
    return errorResponse(error)
  }
}
