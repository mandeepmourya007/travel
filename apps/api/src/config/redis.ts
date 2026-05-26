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
  })
  client.on('connect', () => logger.info('Redis: connected'))
  client.on('error', (err: Error) => logger.error({ error: err.message }, 'Redis connection error'))

  // Connect asynchronously — won't block module import; errors handled by event listener
  client.connect().catch(() => {})

  return client
}

export const redis = createRedisClient()
