import { ValidationError } from "@/server/http/errors"

export function assertJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type")
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase()

  if (mediaType !== "application/json") {
    throw new ValidationError("Request body must be sent as JSON.")
  }
}

export async function readJson(request: Request): Promise<unknown> {
  assertJsonRequest(request)

  try {
    return await request.json()
  } catch {
    throw new ValidationError("Request body must be valid JSON.")
  }
}
