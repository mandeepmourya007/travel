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

function createMockReqResNext(headers: Record<string, string> = {}) {
  const req = { ip: '127.0.0.1', headers } as unknown as Request
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

  // ── healthReadyRateLimit (GET /api/v1/health/ready — 5 req/60s) ──────
  //
  // Deliberately tested here (direct middleware invocation against mock req/res, no
  // real HTTP/Express app) rather than via a real Express route + Supertest: importing
  // apps/api/src/routes/health.routes.ts in the same module graph as this middleware
  // was found to add a large, unexplained fixed latency (~200ms) to the first awaited
  // call in the file — reproducible but not root-caused (isolated to that one import;
  // does not reproduce with any other module in the app, including a hand-built
  // equivalent Router). Testing the exported `healthReadyRateLimit` middleware directly
  // (identifier resolved from the mock req, no health.routes.ts import) avoids the
  // artifact entirely and keeps this suite in the sub-millisecond range. The route-level
  // wiring (guard order, status codes) is covered separately via a small, fixed number
  // of real Supertest requests in tests/integration/health-ready.routes.test.ts.
  describe('healthReadyRateLimit (5 req/60s)', () => {
    it('allows the first 5 requests from the same identifier', async () => {
      const { healthReadyRateLimit } = await import('../../../src/middleware/rate-limit.middleware')
      const ip = '203.0.113.10'

      for (let i = 0; i < 5; i++) {
        const { req, res, next } = createMockReqResNext({ 'x-forwarded-for': ip })
        ;(req as unknown as { ip?: string }).ip = undefined
        await healthReadyRateLimit(req, res, next)
        expect(next).toHaveBeenCalledOnce()
        expect(res.status).not.toHaveBeenCalled()
      }
    })

    it('blocks the 6th request from the same identifier within the window with 429', async () => {
      const { healthReadyRateLimit } = await import('../../../src/middleware/rate-limit.middleware')
      const ip = '203.0.113.11'

      for (let i = 0; i < 5; i++) {
        const { req, res, next } = createMockReqResNext({ 'x-forwarded-for': ip })
        ;(req as unknown as { ip?: string }).ip = undefined
        await healthReadyRateLimit(req, res, next)
      }

      const { req, res, next } = createMockReqResNext({ 'x-forwarded-for': ip })
      ;(req as unknown as { ip?: string }).ip = undefined
      await healthReadyRateLimit(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
      })
    })

    it('does not rate-limit a different identifier once the first is exhausted', async () => {
      const { healthReadyRateLimit } = await import('../../../src/middleware/rate-limit.middleware')
      const exhaustedIp = '203.0.113.12'

      for (let i = 0; i < 6; i++) {
        const { req, res, next } = createMockReqResNext({ 'x-forwarded-for': exhaustedIp })
        ;(req as unknown as { ip?: string }).ip = undefined
        await healthReadyRateLimit(req, res, next)
      }

      const { req, res, next } = createMockReqResNext({ 'x-forwarded-for': '203.0.113.13' })
      ;(req as unknown as { ip?: string }).ip = undefined
      await healthReadyRateLimit(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(res.status).not.toHaveBeenCalled()
    })
  })
})
