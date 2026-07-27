import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { createReportUploadSignature } from "@/server/uploads/service"
import {
  assertRateLimits,
  getRequestIp,
} from "@/server/security/rate-limit"

export const runtime = "nodejs"

// The extension calls this before uploading screenshots straight to Cloudinary.
// Direct upload keeps multi-megabyte base64 images out of the API and database.
export async function POST(request: Request) {
  try {
    const currentSession = await requireCurrentSession()

    await assertRateLimits([
      {
        key: currentSession.user.id,
        limit: 20,
        scope: "uploads.signature.user",
        windowMs: 60 * 1000,
      },
      {
        key: currentSession.user.id,
        limit: 250,
        scope: "uploads.signature.user_daily",
        windowMs: 24 * 60 * 60 * 1000,
      },
      {
        key: getRequestIp(request),
        limit: 60,
        scope: "uploads.signature.ip",
        windowMs: 60 * 1000,
      },
      {
        key: getRequestIp(request),
        limit: 500,
        scope: "uploads.signature.ip_daily",
        windowMs: 24 * 60 * 60 * 1000,
      },
    ])

    const signature = createReportUploadSignature()

    return ok({ upload: signature })
  } catch (error) {
    return errorResponse(error)
  }
}
