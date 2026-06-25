import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock logger before importing anything that uses it
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock ioredis — we don't want a real connection in unit tests
const mockOn = vi.fn()
const mockConnect = vi.fn().mockResolvedValue(undefined)

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: mockOn,
      connect: mockConnect,
    })),
  }
})

describe('Redis client config', () => {
  const originalEnv = process.env.REDIS_URL

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.REDIS_URL
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.REDIS_URL = originalEnv
    } else {
      delete process.env.REDIS_URL
    }
  })

  it('should return null when REDIS_URL is not set', async () => {
    const { redis } = await import('../../../src/config/redis')

    expect(redis).toBeNull()
  })

  it('should log a warning when REDIS_URL is not set', async () => {
    const { logger } = await import('../../../src/utils/logger')
    await import('../../../src/config/redis')

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('REDIS_URL not set'),
    )
  })

  it('should create an IORedis client when REDIS_URL is set', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    const IORedis = (await import('ioredis')).default

    const { redis } = await import('../../../src/config/redis')

    expect(redis).not.toBeNull()
    expect(IORedis).toHaveBeenCalledWith('redis://localhost:6379', {
      keepAlive: 30000,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  })

  it('should register connect and error event handlers', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'

    await import('../../../src/config/redis')

    const events = mockOn.mock.calls.map((c: string[]) => c[0])
    expect(events).toContain('connect')
    expect(events).toContain('error')
  })

  it('should call connect() on the client', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'

    await import('../../../src/config/redis')

    expect(mockConnect).toHaveBeenCalledOnce()
  })

  it('should not crash when connect() rejects', async () => {
    mockConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    process.env.REDIS_URL = 'redis://localhost:6379'

    // Should not throw — connect error is caught
    const { redis } = await import('../../../src/config/redis')
    expect(redis).not.toBeNull()
  })

  it('should log on successful connection', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    const { logger } = await import('../../../src/utils/logger')

    await import('../../../src/config/redis')

    // Find the 'connect' handler and invoke it
    const connectCall = mockOn.mock.calls.find((c: string[]) => c[0] === 'connect')
    expect(connectCall).toBeDefined()
    connectCall![1]()

    expect(logger.info).toHaveBeenCalledWith('Redis: connected')
  })

  it('should log on connection error', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    const { logger } = await import('../../../src/utils/logger')

    await import('../../../src/config/redis')

    // Find the 'error' handler and invoke it
    const errorCall = mockOn.mock.calls.find((c: string[]) => c[0] === 'error')
    expect(errorCall).toBeDefined()
    errorCall![1](new Error('Connection refused'))

    expect(logger.error).toHaveBeenCalledWith(
      { error: 'Connection refused' },
      'Redis connection error',
    )
  })
})
