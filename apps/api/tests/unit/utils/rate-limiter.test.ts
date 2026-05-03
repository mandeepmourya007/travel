import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SlidingWindowRateLimiter } from '../../../src/utils/rate-limiter'

// Minimal ioredis mock — only needs eval()
function createMockRedis(evalResult: [number, number, number, number] = [1, 100, 99, Date.now() + 60000]) {
  return {
    eval: vi.fn().mockResolvedValue(evalResult),
  } as unknown as import('ioredis').default
}

describe('SlidingWindowRateLimiter', () => {
  const PREFIX = 'test'
  const MAX_REQUESTS = 10
  const WINDOW_MS = 60_000
  const IDENTIFIER = '127.0.0.1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('limit', () => {
    it('should allow request when under limit', async () => {
      // Arrange
      const redis = createMockRedis([1, MAX_REQUESTS, 9, Date.now() + WINDOW_MS])
      const limiter = new SlidingWindowRateLimiter(redis, PREFIX, MAX_REQUESTS, WINDOW_MS)

      // Act
      const result = await limiter.limit(IDENTIFIER)

      // Assert
      expect(result.success).toBe(true)
      expect(result.limit).toBe(MAX_REQUESTS)
      expect(result.remaining).toBe(9)
      expect(result.reset).toBeGreaterThan(Date.now())
    })

    it('should reject request when limit exceeded', async () => {
      // Arrange
      const resetTime = Date.now() + WINDOW_MS
      const redis = createMockRedis([0, MAX_REQUESTS, 0, resetTime])
      const limiter = new SlidingWindowRateLimiter(redis, PREFIX, MAX_REQUESTS, WINDOW_MS)

      // Act
      const result = await limiter.limit(IDENTIFIER)

      // Assert
      expect(result.success).toBe(false)
      expect(result.limit).toBe(MAX_REQUESTS)
      expect(result.remaining).toBe(0)
      expect(result.reset).toBe(resetTime)
    })

    it('should pass correct key, timestamp, window, and max to Redis eval', async () => {
      // Arrange
      const redis = createMockRedis()
      const limiter = new SlidingWindowRateLimiter(redis, PREFIX, MAX_REQUESTS, WINDOW_MS)
      const beforeTime = Date.now()

      // Act
      await limiter.limit(IDENTIFIER)

      // Assert
      const call = (redis.eval as ReturnType<typeof vi.fn>).mock.calls[0]
      // arg 0: Lua script (string)
      expect(typeof call[0]).toBe('string')
      expect(call[0]).toContain('ZREMRANGEBYSCORE')
      // arg 1: number of keys
      expect(call[1]).toBe(1)
      // arg 2: key
      expect(call[2]).toBe(`ratelimit:${PREFIX}:${IDENTIFIER}`)
      // arg 3: timestamp (ms) — should be close to now
      const timestamp = parseInt(call[3], 10)
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(timestamp).toBeLessThanOrEqual(Date.now())
      // arg 4: window (ms)
      expect(call[4]).toBe(WINDOW_MS.toString())
      // arg 5: max requests
      expect(call[5]).toBe(MAX_REQUESTS.toString())
    })

    it('should return remaining = max - 1 on first request', async () => {
      // Arrange — Lua script returns: allowed, limit=10, remaining=9, reset
      const redis = createMockRedis([1, MAX_REQUESTS, MAX_REQUESTS - 1, Date.now() + WINDOW_MS])
      const limiter = new SlidingWindowRateLimiter(redis, PREFIX, MAX_REQUESTS, WINDOW_MS)

      // Act
      const result = await limiter.limit(IDENTIFIER)

      // Assert
      expect(result.remaining).toBe(MAX_REQUESTS - 1)
    })

    it('should propagate Redis errors', async () => {
      // Arrange
      const redis = createMockRedis()
      ;(redis.eval as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NOAUTH'))
      const limiter = new SlidingWindowRateLimiter(redis, PREFIX, MAX_REQUESTS, WINDOW_MS)

      // Act & Assert
      await expect(limiter.limit(IDENTIFIER)).rejects.toThrow('NOAUTH')
    })

    it('should use unique keys per identifier', async () => {
      // Arrange
      const redis = createMockRedis()
      const limiter = new SlidingWindowRateLimiter(redis, PREFIX, MAX_REQUESTS, WINDOW_MS)

      // Act
      await limiter.limit('10.0.0.1')
      await limiter.limit('10.0.0.2')

      // Assert
      const calls = (redis.eval as ReturnType<typeof vi.fn>).mock.calls
      expect(calls[0][2]).toBe(`ratelimit:${PREFIX}:10.0.0.1`)
      expect(calls[1][2]).toBe(`ratelimit:${PREFIX}:10.0.0.2`)
    })
  })
})
