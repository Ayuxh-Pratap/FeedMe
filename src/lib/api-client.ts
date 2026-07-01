import type { ApiFailure, ApiSuccess } from "@/server/http/responses"

export class ApiClientError extends Error {
  readonly code: string
  readonly fieldErrors?: ApiFailure["error"]["fieldErrors"]

  constructor(error: ApiFailure["error"]) {
    super(error.message)
    this.name = "ApiClientError"
    this.code = error.code
    this.fieldErrors = error.fieldErrors
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiFailure
    | null

  if (!payload) {
    throw new ApiClientError({
      code: "INVALID_RESPONSE",
      message: "The server returned an invalid response.",
    })
  }

  if (!payload.ok) {
    throw new ApiClientError(payload.error)
  }

  return payload.data
}

export async function getJson<T>(url: string) {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  })

  return readApiResponse<T>(response)
}

export async function postJson<T>(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  })

  return readApiResponse<T>(response)
}

export async function deleteJson<T>(url: string) {
  const response = await fetch(url, {
    method: "DELETE",
    credentials: "include",
  })

  return readApiResponse<T>(response)
}
