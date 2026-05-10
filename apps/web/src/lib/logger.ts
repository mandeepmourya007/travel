// ── Provider interface ───────────────────────────────
export interface ILogProvider {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// ── Key-based PII redaction (minimal, safe) ──────────
const REDACT_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
])

function redact(ctx: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(ctx)) {
    clean[key] = REDACT_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value
  }
  return clean
}

// ── Console provider (default) ───────────────────────
class ConsoleProvider implements ILogProvider {
  log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const method = level === 'debug' ? 'debug' : level
    if (context) {
      // eslint-disable-next-line no-console -- Logger provider must use console
      console[method](`[${level.toUpperCase()}] ${message}`, context)
    } else {
      // eslint-disable-next-line no-console -- Logger provider must use console
      console[method](`[${level.toUpperCase()}] ${message}`)
    }
  }
}

// ── Singleton logger ─────────────────────────────────
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const configLevel: LogLevel =
  (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'warn' : 'debug')

let provider: ILogProvider = new ConsoleProvider()

export function setLogProvider(p: ILogProvider) {
  provider = p
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configLevel]
}

export const feLogger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => {
    if (shouldLog('debug')) provider.log('debug', msg, ctx && redact(ctx))
  },
  info: (msg: string, ctx?: Record<string, unknown>) => {
    if (shouldLog('info')) provider.log('info', msg, ctx && redact(ctx))
  },
  warn: (msg: string, ctx?: Record<string, unknown>) => {
    if (shouldLog('warn')) provider.log('warn', msg, ctx && redact(ctx))
  },
  error: (msg: string, ctx?: Record<string, unknown>) => {
    if (shouldLog('error')) provider.log('error', msg, ctx && redact(ctx))
  },
}
