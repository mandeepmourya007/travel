import pino from 'pino'
import { getRequestLogger } from './request-context'

// pino.transport() spawns a worker thread for all I/O so log writes never
// touch the main event loop. pino.destination({ sync: false }) only buffers
// in the main thread — still blocks under load. Worker thread is the fix.
// destination: 1 = stdout (standard for Docker containers).
const transport = pino.transport(
  process.env.NODE_ENV === 'production'
    ? { target: 'pino/file', options: { destination: 1 } }
    : { target: 'pino-pretty', options: { colorize: true } },
)

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: 'travel-api',
      env: process.env.NODE_ENV,
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'req.body.accountNumber',
        'req.body.ifscCode',
        'req.body.password',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      err: (err: Record<string, unknown>) => ({
        type: (err.constructor as { name?: string })?.name ?? 'Error',
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
        stack: err.stack,
      }),
    },
  },
  transport,
)

// ── Request-aware logger ─────────────────────────────
// Returns ALS child logger if in request context, base logger otherwise.
// Cron jobs / socket handlers get the base logger (graceful fallback).
export function getLogger(): pino.Logger {
  return getRequestLogger() ?? logger
}
