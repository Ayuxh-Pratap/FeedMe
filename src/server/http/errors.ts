export type FieldErrors = Record<string, string[] | undefined>

export class AppError extends Error {
  readonly code: string
  readonly status: number
  readonly fieldErrors?: FieldErrors
  readonly headers?: HeadersInit

  constructor({
    code,
    message,
    status,
    fieldErrors,
    headers,
  }: {
    code: string
    message: string
    status: number
    fieldErrors?: FieldErrors
    headers?: HeadersInit
  }) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
    this.headers = headers
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    const safeRetryAfter = Math.max(1, Math.ceil(retryAfterSeconds))

    super({
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait and try again.",
      status: 429,
      headers: {
        "Retry-After": String(safeRetryAfter),
      },
    })
    this.name = "RateLimitError"
    this.retryAfterSeconds = safeRetryAfter
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the highlighted fields.", fieldErrors?: FieldErrors) {
    super({
      code: "VALIDATION_ERROR",
      message,
      status: 400,
      fieldErrors,
    })
    this.name = "ValidationError"
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You need to sign in to continue.") {
    super({
      code: "UNAUTHORIZED",
      message,
      status: 401,
    })
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super({
      code: "FORBIDDEN",
      message,
      status: 403,
    })
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends AppError {
  constructor(message = "We could not find that resource.") {
    super({
      code: "NOT_FOUND",
      message,
      status: 404,
    })
    this.name = "NotFoundError"
  }
}

export class ConflictError extends AppError {
  constructor(message = "That resource already exists.", fieldErrors?: FieldErrors) {
    super({
      code: "CONFLICT",
      message,
      status: 409,
      fieldErrors,
    })
    this.name = "ConflictError"
  }
}
