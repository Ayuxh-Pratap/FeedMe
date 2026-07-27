import { resendVerificationEmail } from "@/server/auth/service"
import { requestAuthEmailInputSchema } from "@/server/auth/validation"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  assertRateLimits,
  getRequestIp,
} from "@/server/security/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const input = requestAuthEmailInputSchema.parse(await readJson(request))
    const requestIp = getRequestIp(request)

    await assertRateLimits([
      { key: requestIp, limit: 10, scope: "auth.verify_resend.ip", windowMs: 60 * 60 * 1000 },
      { key: input.email, limit: 4, scope: "auth.verify_resend.email", windowMs: 60 * 60 * 1000 },
    ])

    await resendVerificationEmail(input.email, input.nextPath)

    return ok({ message: "If the account needs verification, a new link is on its way." })
  } catch (error) {
    return errorResponse(error)
  }
}
