import { Request, Response, NextFunction } from 'express'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '../config/redis'
import { logger } from '../utils/logger'

function createRateLimiter(prefix: string, maxRequests: number, windowSeconds: number) {
  if (!redis) {
    return (_req: Request, _res: Response, next: NextFunction) => next()
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    prefix: `ratelimit:${prefix}`,
  })

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'
      const { success, limit, remaining, reset } = await limiter.limit(identifier)

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

      next()
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Rate limiter error — allowing request')
      next()
    }
  }
}

export const generalRateLimit = createRateLimiter('general', 100, 60)
export const authRateLimit = createRateLimiter('auth', 10, 60)
export const otpRateLimit = createRateLimiter('otp', 5, 60)
export const webhookRateLimit = createRateLimiter('webhook', 50, 60)
