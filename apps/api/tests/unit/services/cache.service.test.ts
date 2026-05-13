import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CacheService } from '../../../src/services/cache.service'

// ─── Mock Redis ─────────────────────────────────────
function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scanStream: vi.fn(),
  }
}

const mockLogger = {
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as import('pino').Logger

describe('CacheService', () => {
  let redis: ReturnType<typeof createMockRedis>
  let cache: CacheService

  beforeEach(() => {
    vi.clearAllMocks()
    redis = createMockRedis()
    cache = new CacheService(redis as any, mockLogger)
  })

  // ─── getOrSet ───────────────────────────────────────

  describe('getOrSet', () => {
    it('should return cached value on hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ name: 'Goa Trip' }))
      const fetcher = vi.fn()

      const result = await cache.getOrSet('cache:trips:detail:goa', 60, fetcher)

      expect(result).toEqual({ name: 'Goa Trip' })
      expect(fetcher).not.toHaveBeenCalled()
      expect(redis.get).toHaveBeenCalledWith('cache:trips:detail:goa')
    })

    it('should call fetcher and cache result on miss', async () => {
      redis.get.mockResolvedValue(null)
      redis.set.mockResolvedValue('OK')
      const fetcher = vi.fn().mockResolvedValue({ name: 'Manali Trip' })

      const result = await cache.getOrSet('cache:trips:detail:manali', 120, fetcher)

      expect(result).toEqual({ name: 'Manali Trip' })
      expect(fetcher).toHaveBeenCalledOnce()
      expect(redis.set).toHaveBeenCalledWith(
        'cache:trips:detail:manali',
        JSON.stringify({ name: 'Manali Trip' }),
        'EX',
        120,
      )
    })

    it('should call fetcher when Redis is null (graceful degradation)', async () => {
      const nullCache = new CacheService(null, mockLogger)
      const fetcher = vi.fn().mockResolvedValue({ id: '1' })

      const result = await nullCache.getOrSet('key', 60, fetcher)

      expect(result).toEqual({ id: '1' })
      expect(fetcher).toHaveBeenCalledOnce()
    })

    it('should call fetcher when Redis.get throws (graceful degradation)', async () => {
      redis.get.mockRejectedValue(new Error('Connection refused'))
      const fetcher = vi.fn().mockResolvedValue({ fallback: true })

      const result = await cache.getOrSet('key', 60, fetcher)

      expect(result).toEqual({ fallback: true })
      expect(fetcher).toHaveBeenCalledOnce()
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should set correct TTL on cache write', async () => {
      redis.get.mockResolvedValue(null)
      redis.set.mockResolvedValue('OK')
      const fetcher = vi.fn().mockResolvedValue('data')

      await cache.getOrSet('key', 300, fetcher)

      expect(redis.set).toHaveBeenCalledWith('key', '"data"', 'EX', 300)
    })

    it('should still return fetcher result when Redis.set fails', async () => {
      redis.get.mockResolvedValue(null)
      redis.set.mockRejectedValue(new Error('Write error'))
      const fetcher = vi.fn().mockResolvedValue({ ok: true })

      const result = await cache.getOrSet('key', 60, fetcher)

      expect(result).toEqual({ ok: true })
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  // ─── get ────────────────────────────────────────────

  describe('get', () => {
    it('should return parsed value for existing key', async () => {
      redis.get.mockResolvedValue(JSON.stringify([1, 2, 3]))

      const result = await cache.get<number[]>('key')

      expect(result).toEqual([1, 2, 3])
    })

    it('should return null for missing key', async () => {
      redis.get.mockResolvedValue(null)

      const result = await cache.get('key')

      expect(result).toBeNull()
    })

    it('should return null when Redis throws', async () => {
      redis.get.mockRejectedValue(new Error('timeout'))

      const result = await cache.get('key')

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  // ─── del ────────────────────────────────────────────

  describe('del', () => {
    it('should delete a specific key', async () => {
      redis.del.mockResolvedValue(1)

      await cache.del('cache:trips:detail:goa')

      expect(redis.del).toHaveBeenCalledWith('cache:trips:detail:goa')
    })

    it('should not throw when Redis is null', async () => {
      const nullCache = new CacheService(null, mockLogger)

      await expect(nullCache.del('key')).resolves.not.toThrow()
    })
  })

  // ─── invalidateByPrefix ─────────────────────────────

  describe('invalidateByPrefix', () => {
    it('should collect keys then batch-delete after stream ends', async () => {
      const mockStream = {
        on: vi.fn().mockImplementation(function (this: Record<string, unknown>, event: string, cb: (...args: unknown[]) => void) {
          if (event === 'data') {
            cb(['cache:trips:search:abc', 'cache:trips:search:def'])
            cb(['cache:trips:detail:goa'])
          }
          if (event === 'end') cb()
          return this
        }),
      }
      redis.scanStream.mockReturnValue(mockStream)
      redis.del.mockResolvedValue(3)

      const count = await cache.invalidateByPrefix('cache:trips:*')

      expect(count).toBe(3)
      expect(redis.del).toHaveBeenCalledOnce()
      expect(redis.del).toHaveBeenCalledWith('cache:trips:search:abc', 'cache:trips:search:def', 'cache:trips:detail:goa')
    })

    it('should return 0 when no keys match', async () => {
      const mockStream = {
        on: vi.fn().mockImplementation(function (this: Record<string, unknown>, event: string, cb: (...args: unknown[]) => void) {
          if (event === 'end') cb()
          return this
        }),
      }
      redis.scanStream.mockReturnValue(mockStream)

      const count = await cache.invalidateByPrefix('cache:nonexistent:*')

      expect(count).toBe(0)
      expect(redis.del).not.toHaveBeenCalled()
    })

    it('should return 0 when Redis is null', async () => {
      const nullCache = new CacheService(null, mockLogger)

      const count = await nullCache.invalidateByPrefix('cache:trips:*')

      expect(count).toBe(0)
    })

    it('should handle Redis error gracefully', async () => {
      redis.scanStream.mockImplementation(() => { throw new Error('scan failed') })

      const count = await cache.invalidateByPrefix('cache:trips:*')

      expect(count).toBe(0)
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })
})
