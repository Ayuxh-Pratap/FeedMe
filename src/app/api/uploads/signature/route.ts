import { requireCurrentSession } from "@/server/auth/current-user"
import { errorResponse, ok } from "@/server/http/responses"
import { createReportUploadSignature } from "@/server/uploads/service"

export const runtime = "nodejs"

// The extension calls this before uploading screenshots straight to Cloudinary.
// Direct upload keeps multi-megabyte base64 images out of the API and database.
export async function POST() {
  try {
    await requireCurrentSession()
    const signature = createReportUploadSignature()

    return ok({ upload: signature })
  } catch (error) {
    return errorResponse(error)
  }
}
