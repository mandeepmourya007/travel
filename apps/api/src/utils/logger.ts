import pino from 'pino'
import { getRequestLogger } from './request-context'

// ── Base logger (Singleton — unchanged) ──────────────
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: {
    service: 'travel-api',
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
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
})

// ── Request-aware logger ─────────────────────────────
// Returns ALS child logger if in request context, base logger otherwise.
// Cron jobs / socket handlers get the base logger (graceful fallback).
export function getLogger(): pino.Logger {
  return getRequestLogger() ?? logger
}
