import { loginWithEmail } from "@/server/auth/service"
import { setSessionCookie } from "@/server/auth/sessions"
import { loginInputSchema } from "@/server/auth/validation"
import { errorResponse, ok } from "@/server/http/responses"
import { readJson } from "@/server/http/request"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const input = loginInputSchema.parse(await readJson(request))
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
