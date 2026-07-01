import { revokeCurrentSession } from "@/server/auth/sessions"
import { errorResponse, ok } from "@/server/http/responses"

export const runtime = "nodejs"

export async function POST() {
  try {
    await revokeCurrentSession()

    return ok({
      nextPath: "/login",
    })
  } catch (error) {
    return errorResponse(error)
  }
}
