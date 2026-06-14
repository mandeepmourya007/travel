import { redis } from '../config/redis'
import { logger } from './logger'

/**
 * Lua script: atomically delete the lock key only if the stored token
 * matches what we set — prevents releasing a lock we no longer own
 * (e.g. if the lock TTL expired and another instance re-acquired it).
 */
const RELEASE_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  else
    return 0
  end
`

/**
 * Runs `fn` under a distributed Redis lock.
 *
 * Acquire: SET key <token> NX PX ttlMs
 * Release: token-checked Lua DEL (never releases a lock we no longer hold)
 *
 * When Redis is unavailable (null client — dev / CI), `fn` is called
 * directly so single-instance behaviour is unchanged.
 *
 * Important: docker-compose.prod.yml uses volatile-lru. Lock keys carry a
 * TTL (PX), so they ARE evictable under memory pressure — this is intentional
 * (a dropped lock is safer than a deadlock). The DB-level partial unique index
 * on PaymentTransaction is the hard backstop for the escrow case.
 *
 * @param key    Redis lock key, e.g. 'cron:expire-stale-bookings'
 * @param ttlMs  Lock TTL in milliseconds. Size generously above worst-case runtime.
 * @param fn     Work to perform while holding the lock.
 * @returns true if the lock was acquired and `fn` ran; false if another instance
 *          already holds it (caller should skip this run).
 */
export async function withLock(
  key: string,
  ttlMs: number,
  fn: () => Promise<void>,
): Promise<boolean> {
  if (!redis) {
    // No Redis — run directly (single-instance / dev mode)
    await fn()
    return true
  }

  // Generate a unique token for this acquisition so the Lua release is safe
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const acquired = await redis.set(key, token, 'PX', ttlMs, 'NX')
  if (acquired !== 'OK') {
    // Another instance holds this lock — skip this run
    return false
  }

  try {
    await fn()
    return true
  } finally {
    // Release only if we still own the lock
    try {
      await redis.eval(RELEASE_SCRIPT, 1, key, token)
    } catch (err) {
      logger.warn({ key, err }, 'redis-lock: failed to release lock (TTL will auto-expire it)')
    }
  }
}
