import IORedis from 'ioredis'
import { logger } from '../utils/logger'
import { env } from './env'

/**
 * Creates a singleton ioredis client.
 * Connects via REDIS_URL (TCP, e.g. redis://:password@host:6379).
 * Returns null when REDIS_URL is unset — rate limiting gracefully disabled.
 */
function createRedisClient(): IORedis | null {
  const url = env.REDIS_URL
  if (!url) {
    logger.warn('REDIS_URL not set — rate limiting and caching disabled')
    return null
  }

  const client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    // Keep the TCP connection alive with 30s pings so the connection is never
    // dropped by Render's idle timeout. Without this, the first request after
    // inactivity pays a 600-700ms reconnect penalty.
    keepAlive: 30000,
    // NOTE: commandTimeout is intentionally NOT set here — it applies to the
    // initial TLS + AUTH handshake too, which crashes the process on startup
    // if the handshake takes >timeout. Per-operation timeouts are applied at
    // the call site (rate limiter, cache) via Promise.race() instead.
  })
  client.on('connect', () => logger.info('Redis: connected'))
  client.on('error', (err: Error) => logger.error({ error: err.message }, 'Redis connection error'))

  // Connect asynchronously — won't block module import; errors handled by event listener
  client.connect().catch(() => {})

  return client
}

export const redis = createRedisClient()
