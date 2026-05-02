import { Request, Response, NextFunction } from 'express'
import { AppError, ValidationError } from '../errors/app-error'
import { logger } from '../utils/logger'

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError && err.isOperational) {
    logger.warn({
      code: err.code,
      message: err.message,
      path: req.path,
      method: req.method,
    }, 'Operational error')
  } else {
    logger.error({
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    }, 'Unexpected error')
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

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  })
}
