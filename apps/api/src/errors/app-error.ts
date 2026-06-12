export class AppError extends Error {
  /** Optional discriminator within the same `code` — lets clients branch on
   *  structure instead of parsing message text (e.g. SEAT_CONFLICT vs ALREADY_BOOKED) */
  public subCode?: string

  constructor(
    public message: string,
    public statusCode: number,
    public code: string,
    public isOperational: boolean = true,
  ) {
    super(message)
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ConflictError extends AppError {
  constructor(message: string, subCode?: string) {
    super(message, 409, 'CONFLICT')
    this.subCode = subCode
  }
}

export class PaymentError extends AppError {
  constructor(
    message: string,
    public razorpayError?: unknown,
  ) {
    super(message, 502, 'PAYMENT_FAILED')
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS')
  }
}
