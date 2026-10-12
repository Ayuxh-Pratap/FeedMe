import { signupWithEmail } from "@/server/auth/service"
import { setSessionCookie } from "@/server/auth/sessions"
import { signupInputSchema } from "@/server/auth/validation"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import {
  assertRateLimits,
  getRequestIp,
  rateLimitKey,
} from "@/server/security/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const requestIp = getRequestIp(request)

    await assertRateLimits([
      {
        key: requestIp,
        limit: 8,
        scope: "auth.signup.ip",
        windowMs: 60 * 60 * 1000,
      },
      {
        key: rateLimitKey([requestIp, request.headers.get("user-agent")]),
        limit: 4,
        scope: "auth.signup.client",
        windowMs: 60 * 60 * 1000,
      },
    ])

    const input = signupInputSchema.parse(await readJson(request))
    const result = await signupWithEmail(input)

    if (result.flow === "authenticated") {
      await setSessionCookie(result.sessionToken, result.sessionExpiresAt)

      return ok(
        {
          user: result.user,
          nextPath: result.nextPath,
        },
        { status: 201 }
      )
    }

    return ok({ nextPath: result.nextPath }, { status: 202 })
  } catch (error) {
    return errorResponse(error)
  }
}
