export type FieldErrors = Record<string, string[] | undefined>

export class AppError extends Error {
  readonly code: string
  readonly status: number
  readonly fieldErrors?: FieldErrors

  constructor({
    code,
    message,
    status,
    fieldErrors,
  }: {
    code: string
    message: string
    status: number
    fieldErrors?: FieldErrors
  }) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
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
