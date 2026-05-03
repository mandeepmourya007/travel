import type IORedis from 'ioredis'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  /** Unix timestamp (ms) when the window resets */
  reset: number
}

/**
 * Atomic Lua script — sliding window via sorted sets.
 * Each request is a ZSET member scored by its timestamp (ms).
 * Expired entries are pruned, then count is checked against max.
 *
 * KEYS[1] = rate limit key
 * ARGV[1] = now (ms), ARGV[2] = window (ms), ARGV[3] = max requests
 * Returns [success(0|1), limit, remaining, reset(ms)]
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

local count = redis.call('ZCARD', key)

if count < max then
  redis.call('ZADD', key, now, tostring(now) .. ':' .. tostring(math.random(1000000000)))
  redis.call('PEXPIRE', key, window)
  return {1, max, max - count - 1, now + window}
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = now + window
  if oldest and oldest[2] then
    reset = tonumber(oldest[2]) + window
  end
  return {0, max, 0, reset}
end
`

/**
 * Sliding-window rate limiter backed by Redis sorted sets.
 * Atomic via Lua script — safe under concurrent access.
 *
 * Usage:
 *   const limiter = new SlidingWindowRateLimiter(redis, 'auth', 10, 60_000)
 *   const { success, remaining } = await limiter.limit(req.ip)
 */
export class SlidingWindowRateLimiter {
  constructor(
    private readonly redis: IORedis,
    private readonly prefix: string,
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Check and record a request for the given identifier.
   * @param identifier - Unique client key (IP, userId, etc.)
   * @returns Rate limit result with success flag and metadata
   */
  async limit(identifier: string): Promise<RateLimitResult> {
    const key = `ratelimit:${this.prefix}:${identifier}`
    const now = Date.now()

    const result = (await this.redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      now.toString(),
      this.windowMs.toString(),
      this.maxRequests.toString(),
    )) as [number, number, number, number]

    return {
      success: result[0] === 1,
      limit: result[1],
      remaining: result[2],
      reset: result[3],
    }
  }
}
