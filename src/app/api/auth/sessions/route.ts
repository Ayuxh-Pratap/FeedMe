import { requireCurrentSession } from "@/server/auth/current-user"
import {
  listUserSessions,
  revokeOtherUserSessions,
} from "@/server/auth/sessions"
import { errorResponse, ok } from "@/server/http/responses"

export const runtime = "nodejs"

export async function GET() {
  try {
    const currentSession = await requireCurrentSession()
    const sessions = await listUserSessions(
      currentSession.user.id,
      currentSession.session.id
    )

    return ok({ sessions })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE() {
  try {
    const currentSession = await requireCurrentSession()
    const result = await revokeOtherUserSessions(
      currentSession.user.id,
      currentSession.session.id
    )

    return ok(result)
  } catch (error) {
    return errorResponse(error)
  }
}
