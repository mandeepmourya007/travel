import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginAttemptTracker } from '../../../src/utils/login-attempt-tracker'

// Suppress logger output in tests
vi.mock('../../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ── Test with in-memory fallback (redis = null) ──────────

describe('LoginAttemptTracker (in-memory)', () => {
  let tracker: LoginAttemptTracker

  beforeEach(() => {
    tracker = new LoginAttemptTracker(null)
  })

  it('should report not locked for fresh email', async () => {
    const remaining = await tracker.isLocked('fresh@example.com')
    expect(remaining).toBe(0)
  })

  it('should record failures and return remaining attempts', async () => {
    const r1 = await tracker.recordFailure('test@example.com')
    expect(r1.locked).toBe(false)
    expect(r1.remainingAttempts).toBe(4)

    const r2 = await tracker.recordFailure('test@example.com')
    expect(r2.remainingAttempts).toBe(3)
  })

  it('should lock account after 5 failed attempts', async () => {
    const email = 'lockme@example.com'

    for (let i = 0; i < 4; i++) {
      await tracker.recordFailure(email)
    }

    const result = await tracker.recordFailure(email)
    expect(result.locked).toBe(true)
    expect(result.remainingAttempts).toBe(0)

    const lockRemaining = await tracker.isLocked(email)
    expect(lockRemaining).toBeGreaterThan(0)
  })

  it('should reset attempts on successful login', async () => {
    const email = 'reset@example.com'

    await tracker.recordFailure(email)
    await tracker.recordFailure(email)
    await tracker.resetAttempts(email)

    // After reset, next failure should show 4 remaining (fresh start)
    const result = await tracker.recordFailure(email)
    expect(result.remainingAttempts).toBe(4)
  })

  it('should track attempts independently per email', async () => {
    await tracker.recordFailure('a@test.com')
    await tracker.recordFailure('a@test.com')

    const resultB = await tracker.recordFailure('b@test.com')
    expect(resultB.remainingAttempts).toBe(4) // b is fresh
  })
})

// ── Test with mock Redis ─────────────────────────────────

describe('LoginAttemptTracker (Redis)', () => {
  let tracker: LoginAttemptTracker
  let mockRedis: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    mockRedis = {
      ttl: vi.fn().mockResolvedValue(-2),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    }
    tracker = new LoginAttemptTracker(mockRedis as any)
  })

  it('should check lockout via Redis TTL', async () => {
    mockRedis.ttl.mockResolvedValue(300)

    const remaining = await tracker.isLocked('locked@test.com')

    expect(remaining).toBe(300)
    expect(mockRedis.ttl).toHaveBeenCalledWith('login_lockout:locked@test.com')
  })

  it('should return 0 when not locked in Redis', async () => {
    mockRedis.ttl.mockResolvedValue(-2)

    const remaining = await tracker.isLocked('free@test.com')
    expect(remaining).toBe(0)
  })

  it('should increment attempts in Redis', async () => {
    mockRedis.incr.mockResolvedValue(2)

    const result = await tracker.recordFailure('inc@test.com')

    expect(result.locked).toBe(false)
    expect(result.remainingAttempts).toBe(3)
    expect(mockRedis.incr).toHaveBeenCalledWith('login_attempts:inc@test.com')
  })

  it('should set expire on first attempt', async () => {
    mockRedis.incr.mockResolvedValue(1)

    await tracker.recordFailure('first@test.com')

    expect(mockRedis.expire).toHaveBeenCalledWith('login_attempts:first@test.com', 900)
  })

  it('should lock via Redis after 5 attempts', async () => {
    mockRedis.incr.mockResolvedValue(5)

    const result = await tracker.recordFailure('lockredis@test.com')

    expect(result.locked).toBe(true)
    expect(mockRedis.setex).toHaveBeenCalledWith('login_lockout:lockredis@test.com', 900, '1')
    expect(mockRedis.del).toHaveBeenCalledWith('login_attempts:lockredis@test.com')
  })

  it('should clear both keys on resetAttempts', async () => {
    await tracker.resetAttempts('clear@test.com')

    expect(mockRedis.del).toHaveBeenCalledWith(
      'login_attempts:clear@test.com',
      'login_lockout:clear@test.com',
    )
  })

  it('should fall back to in-memory when Redis throws', async () => {
    mockRedis.incr.mockRejectedValue(new Error('Redis down'))

    const result = await tracker.recordFailure('fallback@test.com')

    // Falls back to in-memory — first attempt
    expect(result.locked).toBe(false)
    expect(result.remainingAttempts).toBe(4)
  })

  it('should fall back to in-memory for isLocked when Redis throws', async () => {
    mockRedis.ttl.mockRejectedValue(new Error('Redis down'))

    const remaining = await tracker.isLocked('fallback-lock@test.com')
    expect(remaining).toBe(0)
  })
})
