import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info(
      {
        requestId: req.headers['x-request-id'],
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      },
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
    )
  })
  next()
}
