import { Request, Response, NextFunction } from 'express'
import { redis } from '../config/redis'
import { SlidingWindowRateLimiter } from '../utils/rate-limiter'
import { logger } from '../utils/logger'

/**
 * Lightweight in-memory sliding window rate limiter.
 * Used as a fallback when Redis is unavailable.
 * Not shared across processes — per-instance only — but still prevents single-process abuse.
 */
class InMemoryRateLimiter {
  private windows = new Map<string, number[]>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {
    // Periodically purge stale entries to prevent memory leak
    this.cleanupInterval = setInterval(() => this.cleanup(), windowMs * 2)
    this.cleanupInterval.unref()
  }

  limit(identifier: string): { success: boolean; remaining: number } {
    const now = Date.now()
    const timestamps = this.windows.get(identifier) ?? []
    const windowStart = now - this.windowMs

    // Remove expired timestamps
    const valid = timestamps.filter((t) => t > windowStart)

    if (valid.length >= this.maxRequests) {
      this.windows.set(identifier, valid)
      return { success: false, remaining: 0 }
    }

    valid.push(now)
    this.windows.set(identifier, valid)
    return { success: true, remaining: this.maxRequests - valid.length }
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, timestamps] of this.windows) {
      const valid = timestamps.filter((t) => t > now - this.windowMs)
      if (valid.length === 0) this.windows.delete(key)
      else this.windows.set(key, valid)
    }
  }
}

function createRateLimiter(prefix: string, maxRequests: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1000
  const memoryFallback = new InMemoryRateLimiter(maxRequests, windowMs)
  const redisLimiter = redis
    ? new SlidingWindowRateLimiter(redis, prefix, maxRequests, windowMs)
    : null

  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'

    // Try Redis first, fall back to in-memory on error or if Redis is unavailable.
    // Race against 200ms — if Redis is reconnecting (e.g. after idle), we fall
    // back to in-memory rather than blocking the request. commandTimeout can't
    // be used on the ioredis client because it also applies to TLS+AUTH on
    // startup, causing process crashes.
    if (redisLimiter) {
      try {
        const { success, limit, remaining, reset } = await Promise.race([
          redisLimiter.limit(identifier),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Redis rate limit timeout')), 200),
          ),
        ])

        res.setHeader('X-RateLimit-Limit', limit)
        res.setHeader('X-RateLimit-Remaining', remaining)
        res.setHeader('X-RateLimit-Reset', reset)

        if (!success) {
          logger.warn({ ip: identifier, prefix }, 'Rate limit exceeded')
          return res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests. Please try again later.',
            },
          })
        }

        return next()
      } catch (err) {
        logger.error({ error: (err as Error).message, prefix }, 'Redis rate limiter error — falling back to in-memory')
      }
    }

    // In-memory fallback
    const result = memoryFallback.limit(identifier)
    res.setHeader('X-RateLimit-Limit', maxRequests)
    res.setHeader('X-RateLimit-Remaining', result.remaining)

    if (!result.success) {
      logger.warn({ ip: identifier, prefix, fallback: true }, 'Rate limit exceeded (in-memory)')
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      })
    }

    next()
  }
}

export const generalRateLimit = createRateLimiter('general', 100, 60)
export const authRateLimit = createRateLimiter('auth', 10, 60)
export const otpRateLimit = createRateLimiter('otp', 5, 60)
export const webhookRateLimit = createRateLimiter('webhook', 50, 60)
// Stricter tier for money-sensitive endpoints (booking creation, payment
// verification, cancellation). 20/min per IP stops brute-force payment
// attempts while leaving headroom for legitimate multi-leg bookings.
export const bookingRateLimit = createRateLimiter('booking', 20, 60)
