import pinoHttp, { type Options } from 'pino-http'
import { v4 as uuidv4 } from 'uuid'
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { requestContext } from '../utils/request-context'

const options: Options<Request, Response> = {
  logger,
  genReqId: (req) => (req.headers['x-request-id'] as string) || uuidv4(),

  // Called at RESPONSE time — req.user is available by then
  customProps: (req) => ({
    userId: req.user?.userId,
    role: req.user?.role,
  }),

  // Route-aware log levels
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },

  // Don't log health checks
  autoLogging: {
    ignore: (req) => {
      const url = req.originalUrl ?? req.url
      return url === '/health' || url === '/api/v1/health'
    },
  },
}

const httpLogger = pinoHttp(options)

// Wrap pino-http in ALS.run() so downstream code can call getRequestLogger()
export function pinoHttpMiddleware(req: Request, res: Response, next: NextFunction) {
  httpLogger(req, res, () => {
    const store = {
      logger: req.log,
      requestId: req.id as string,
    }
    requestContext.run(store, () => next())
  })
}
