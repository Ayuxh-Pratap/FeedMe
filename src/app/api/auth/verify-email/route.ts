import { verifyEmailAddress } from "@/server/auth/service"
import { setSessionCookie } from "@/server/auth/sessions"
import { authActionTokenInputSchema } from "@/server/auth/validation"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { assertRateLimits, getRequestIp } from "@/server/security/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const input = authActionTokenInputSchema.parse(await readJson(request))

    await assertRateLimits([
      { key: getRequestIp(request), limit: 20, scope: "auth.verify.ip", windowMs: 60 * 60 * 1000 },
      { key: input.token, limit: 5, scope: "auth.verify.token", windowMs: 60 * 60 * 1000 },
    ])

    const result = await verifyEmailAddress(input.token)
    await setSessionCookie(result.sessionToken, result.sessionExpiresAt)

    return ok({
      user: { id: result.user.id, email: result.user.email },
      nextPath: result.nextPath,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
