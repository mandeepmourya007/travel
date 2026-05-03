import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'

// Mock redis module — must be before middleware import
vi.mock('../../../src/config/redis', () => ({
  redis: null,
}))

vi.mock('../../../src/utils/rate-limiter', () => ({
  SlidingWindowRateLimiter: vi.fn(),
}))

vi.mock('../../../src/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

function createMockReqResNext() {
  const req = { ip: '127.0.0.1', headers: {} } as unknown as Request
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  const next = vi.fn() as NextFunction
  return { req, res, next }
}

describe('rate-limit.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('when Redis is null', () => {
    it('should pass through without rate limiting', async () => {
      // Arrange — redis is null (default mock)
      const { generalRateLimit } = await import(
        '../../../src/middleware/rate-limit.middleware'
      )
      const { req, res, next } = createMockReqResNext()

      // Act
      await generalRateLimit(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledOnce()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  describe('when Redis is available', () => {
    it('should allow request and set rate limit headers', async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
      })
      const { SlidingWindowRateLimiter } = await import(
        '../../../src/utils/rate-limiter'
      )
      ;(SlidingWindowRateLimiter as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({ limit: mockLimit }),
      )

      // Re-mock redis to return a truthy value
      vi.doMock('../../../src/config/redis', () => ({
        redis: { eval: vi.fn() },
      }))
      const { generalRateLimit } = await import(
        '../../../src/middleware/rate-limit.middleware'
      )
      const { req, res, next } = createMockReqResNext()

      // Act
      await generalRateLimit(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledOnce()
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100)
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 99)
    })

    it('should return 429 when limit exceeded', async () => {
      // Arrange
      const mockLimit = vi.fn().mockResolvedValue({
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 60000,
      })
      const { SlidingWindowRateLimiter } = await import(
        '../../../src/utils/rate-limiter'
      )
      ;(SlidingWindowRateLimiter as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({ limit: mockLimit }),
      )

      vi.doMock('../../../src/config/redis', () => ({
        redis: { eval: vi.fn() },
      }))
      const { generalRateLimit } = await import(
        '../../../src/middleware/rate-limit.middleware'
      )
      const { req, res, next } = createMockReqResNext()

      // Act
      await generalRateLimit(req, res, next)

      // Assert
      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      })
    })

    it('should allow request when Redis throws an error', async () => {
      // Arrange
      const mockLimit = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      const { SlidingWindowRateLimiter } = await import(
        '../../../src/utils/rate-limiter'
      )
      ;(SlidingWindowRateLimiter as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        () => ({ limit: mockLimit }),
      )

      vi.doMock('../../../src/config/redis', () => ({
        redis: { eval: vi.fn() },
      }))
      const { generalRateLimit } = await import(
        '../../../src/middleware/rate-limit.middleware'
      )
      const { req, res, next } = createMockReqResNext()

      // Act
      await generalRateLimit(req, res, next)

      // Assert — fail-open: allows request
      expect(next).toHaveBeenCalledOnce()
      expect(res.status).not.toHaveBeenCalled()
    })
  })
})
