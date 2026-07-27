import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { AppError, type FieldErrors } from "@/server/http/errors"

export type ApiSuccess<T> = {
  ok: true
  data: T
}

export type ApiFailure = {
  ok: false
  error: {
    code: string
    message: string
    fieldErrors?: FieldErrors
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>(
    {
      ok: true,
      data,
    },
    init
  )
}

export function fail(error: ApiFailure["error"], init?: ResponseInit) {
  return NextResponse.json<ApiFailure>(
    {
      ok: false,
      error,
    },
    init
  )
}

function cleanFieldErrors(fieldErrors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(([, messages]) => messages && messages.length > 0)
  )
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return fail(
      {
        code: "VALIDATION_ERROR",
        message: "Please check the highlighted fields.",
        fieldErrors: cleanFieldErrors(error.flatten().fieldErrors),
      },
      { status: 400 }
    )
  }

  if (error instanceof AppError) {
    return fail(
      {
        code: error.code,
        message: error.message,
        fieldErrors: error.fieldErrors,
      },
      { status: error.status, headers: error.headers }
    )
  }

  console.error(error)

  return fail(
    {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong. Please try again.",
    },
    { status: 500 }
  )
}
