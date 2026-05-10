import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError, ValidationError } from '../errors/app-error'
import { logger } from '../utils/logger'

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // Use request-scoped logger (pino-http child) — includes requestId + userId.
  // Falls back to base logger if pino-http didn't run (e.g. webhook raw body routes).
  const log = req.log ?? logger

  if (err instanceof AppError && err.isOperational) {
    log.warn({ err, path: req.path, method: req.method }, 'Operational error')
  } else {
    log.error({ err, path: req.path, method: req.method }, 'Unexpected error')
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && err.details ? { details: err.details } : {}),
      },
    })
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      },
    })
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  })
}
