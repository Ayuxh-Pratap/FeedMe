import { resetPassword } from "@/server/auth/service"
import { setSessionCookie } from "@/server/auth/sessions"
import { resetPasswordInputSchema } from "@/server/auth/validation"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"
import { assertRateLimits, getRequestIp } from "@/server/security/rate-limit"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const input = resetPasswordInputSchema.parse(await readJson(request))

    await assertRateLimits([
      { key: getRequestIp(request), limit: 20, scope: "auth.password_reset.ip", windowMs: 60 * 60 * 1000 },
      { key: input.token, limit: 5, scope: "auth.password_reset.token", windowMs: 60 * 60 * 1000 },
    ])

    const result = await resetPassword(input)
    await setSessionCookie(result.sessionToken, result.sessionExpiresAt)

    return ok({ user: result.user, nextPath: result.nextPath })
  } catch (error) {
    return errorResponse(error)
  }
}
