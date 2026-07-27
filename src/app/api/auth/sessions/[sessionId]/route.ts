import { requireCurrentSession } from "@/server/auth/current-user"
import { sessionIdParamSchema } from "@/server/auth/session-validation"
import {
  clearSessionCookie,
  revokeUserSession,
} from "@/server/auth/sessions"
import { errorResponse, ok } from "@/server/http/responses"

export const runtime = "nodejs"

type Context = { params: Promise<{ sessionId: string }> }

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const currentSession = await requireCurrentSession()
    const sessionId = sessionIdParamSchema.parse((await params).sessionId)
    const result = await revokeUserSession(
      currentSession.user.id,
      currentSession.session.id,
      sessionId
    )

    if (result.signedOut) {
      await clearSessionCookie()
    }

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
