import { requireCurrentSession } from "@/server/auth/current-user"
import { getExtensionBootstrap } from "@/server/extension/service"
import { errorResponse, ok } from "@/server/http/responses"

export const runtime = "nodejs"

export async function GET() {
  try {
    const currentSession = await requireCurrentSession()
    const bootstrap = await getExtensionBootstrap(currentSession)

    return ok(bootstrap)
  } catch (error) {
    return errorResponse(error)
  }
}
