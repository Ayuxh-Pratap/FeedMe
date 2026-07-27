import { loginWithEmail } from "@/server/auth/service"
import { setSessionCookie } from "@/server/auth/sessions"
import { loginInputSchema } from "@/server/auth/validation"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  assertRateLimit,
  assertRateLimits,
  getRequestIp,
  rateLimitKey,
} from "@/server/security/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const requestIp = getRequestIp(request)

    await assertRateLimit({
      key: requestIp,
      limit: 30,
      scope: "auth.login.ip",
      windowMs: 10 * 60 * 1000,
    })

    const input = loginInputSchema.parse(await readJson(request))

    await assertRateLimits([
      {
        key: rateLimitKey([requestIp, input.email]),
        limit: 8,
        scope: "auth.login.ip_email",
        windowMs: 10 * 60 * 1000,
      },
      {
        key: input.email,
        limit: 20,
        scope: "auth.login.email",
        windowMs: 60 * 60 * 1000,
      },
    ])

    const result = await loginWithEmail(input)

    await setSessionCookie(result.sessionToken, result.sessionExpiresAt)

    return ok({
      user: result.user,
      nextPath: result.nextPath,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
