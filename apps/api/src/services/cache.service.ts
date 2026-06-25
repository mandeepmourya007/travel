import type IORedis from 'ioredis'
import type { Logger } from 'pino'

/**
 * Generic Redis cache service using the Cache-Aside (Lazy Loading) pattern.
 *
 * Injected into services via constructor DI. Gracefully degrades when Redis
 * is unavailable — falls through to the fetcher function so the app stays up.
 *
 * Usage:
 *   const result = await this.cache.getOrSet(key, ttl, () => this.repo.find(...))
 */
export class CacheService {
  constructor(
    private redis: IORedis | null,
    private logger: Logger,
  ) {}

  /**
   * Cache-aside: return cached value if present, otherwise call fetcher,
   * cache the result, and return it.
   *
   * @param key        — Redis key (use cacheKeys builders from utils/cache-keys.ts)
   * @param ttlSeconds — Time-to-live in seconds
   * @param fetcher    — Async function that produces the value on cache miss
   */
  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    if (!this.redis) return fetcher()

    try {
      const cached = await this.redis.get(key)
      if (cached !== null) {
        this.logger.debug({ key }, 'Cache HIT')
        return JSON.parse(cached) as T
      }
    } catch (err) {
      this.logger.warn({ err, key }, 'Redis GET failed — falling through to fetcher')
    }

    this.logger.debug({ key, ttlSeconds }, 'Cache MISS — fetching & caching')
    const value = await fetcher()

    // Fire-and-forget: don't block the response waiting for the cache write.
    // On cross-region Redis (~95ms RTT), awaiting SET adds latency the caller
    // already paid for on the GET. A failed SET just means the next request
    // is also a miss — acceptable trade-off.
    this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch((err) => {
      this.logger.warn({ err, key }, 'Redis SET failed — value not cached')
    })

    return value
  }

  /** Get a cached value. Returns null on miss or Redis error. */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null

    try {
      const cached = await this.redis.get(key)
      if (cached === null) return null
      return JSON.parse(cached) as T
    } catch (err) {
      this.logger.warn({ err, key }, 'Redis GET failed')
      return null
    }
  }

  /** Set a value with TTL. Silently fails on Redis error. */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.redis) return

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch (err) {
      this.logger.warn({ err, key }, 'Redis SET failed')
    }
  }

  /** Delete a specific cache key. */
  async del(key: string): Promise<void> {
    if (!this.redis) return

    try {
      await this.redis.del(key)
    } catch (err) {
      this.logger.warn({ err, key }, 'Redis DEL failed')
    }
  }

  /**
   * Delete all keys matching a glob pattern (e.g., 'cache:trips:*').
   * Uses SCAN to avoid blocking Redis with KEYS command.
   *
   * @returns Number of keys deleted
   */
  async invalidateByPrefix(pattern: string): Promise<number> {
    if (!this.redis) return 0

    try {
      const stream = this.redis.scanStream({ match: pattern, count: 100 })
      const allKeys: string[] = []

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          allKeys.push(...keys)
        })
        stream.on('end', () => resolve())
        stream.on('error', (err: Error) => reject(err))
      })

      let deleted = 0
      if (allKeys.length > 0) {
        deleted = await this.redis.del(...allKeys)
      }

      if (deleted > 0) {
        this.logger.debug({ pattern, deleted }, 'Cache invalidated by prefix')
      }

      return deleted
    } catch (err) {
      this.logger.warn({ err, pattern }, 'Redis SCAN/DEL failed — cache not invalidated')
      return 0
    }
  }
}
