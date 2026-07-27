import type { ApiFailure, ApiSuccess } from "@/server/http/responses"
import {
  FEEDME_CLIENT_HEADER,
  FEEDME_DASHBOARD_CLIENT,
} from "@/lib/api-trust"

export class ApiClientError extends Error {
  readonly code: string
  readonly fieldErrors?: ApiFailure["error"]["fieldErrors"]
  readonly status: number

  constructor(error: ApiFailure["error"], status = 500) {
    super(error.message)
    this.name = "ApiClientError"
    this.code = error.code
    this.fieldErrors = error.fieldErrors
    this.status = status
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
    }, response.status)
  }

  if (!payload.ok) {
    const error = new ApiClientError(payload.error, response.status)

    if (response.status === 401 && typeof window !== "undefined") {
      const nextPath = `${window.location.pathname}${window.location.search}`
      window.location.assign(`/login?next=${encodeURIComponent(nextPath)}`)
    }

    throw error
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
      [FEEDME_CLIENT_HEADER]: FEEDME_DASHBOARD_CLIENT,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  })

  return readApiResponse<T>(response)
}

export async function patchJson<T>(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      [FEEDME_CLIENT_HEADER]: FEEDME_DASHBOARD_CLIENT,
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  })

  return readApiResponse<T>(response)
}

export async function putJson<T>(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      [FEEDME_CLIENT_HEADER]: FEEDME_DASHBOARD_CLIENT,
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
    headers: {
      [FEEDME_CLIENT_HEADER]: FEEDME_DASHBOARD_CLIENT,
    },
    credentials: "include",
  })

  return readApiResponse<T>(response)
}
