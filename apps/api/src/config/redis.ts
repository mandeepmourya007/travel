import { Redis } from '@upstash/redis'
import { logger } from '../utils/logger'

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL
  const token = process.env.REDIS_TOKEN

  if (!url || !token) {
    logger.warn('Redis not configured — rate limiting and caching disabled')
    return null
  }

  return new Redis({ url, token })
}

export const redis = createRedisClient()
