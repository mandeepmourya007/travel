import pinoHttp, { type Options } from 'pino-http'
import { v4 as uuidv4, validate as isUuid } from 'uuid'
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { requestContext } from '../utils/request-context'

function sanitizeRequestId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const raw = req.headers['x-request-id']
  if (typeof raw === 'string' && isUuid(raw)) return raw
  return uuidv4()
}

const isProd = process.env.NODE_ENV === 'production'

const options: Options<Request, Response> = {
  logger,
  genReqId: (req) => sanitizeRequestId(req as { headers: Record<string, string | string[] | undefined> }),

  // Called at RESPONSE time — req.user is available by then
  customProps: (req) => ({
    userId: req.user?.userId,
    role: req.user?.role,
  }),

  // Route-aware log levels — successful requests are debug in prod (silent unless LOG_LEVEL=debug)
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return isProd ? 'debug' : 'info'
  },

  // Only log essential request fields — drop verbose headers
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },

  // Don't log health checks or preflight OPTIONS
  autoLogging: {
    ignore: (req) => {
      const url = req.originalUrl ?? req.url
      return url === '/health' || url === '/api/v1/health' || req.method === 'OPTIONS'
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
