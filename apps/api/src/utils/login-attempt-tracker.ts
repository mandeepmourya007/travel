import type IORedis from 'ioredis'
import { logger } from './logger'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_SECONDS = 15 * 60 // 15 minutes

/**
 * Tracks failed login attempts per email to prevent brute-force attacks.
 * Uses Redis when available, falls back to in-memory Map.
 *
 * Key design decisions:
 * - Per-email tracking (not per-IP) — distributed attackers use many IPs
 * - Lockout expires automatically after LOCKOUT_SECONDS
 * - Successful login resets the counter
 * - In-memory fallback is per-process only but still provides protection
 */
export class LoginAttemptTracker {
  private memoryStore = new Map<string, { count: number; lockedUntil: number; updatedAt: number }>()
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor(private redis: IORedis | null) {
    this.cleanupInterval = setInterval(() => this.cleanupMemory(), 5 * 60 * 1000)
    this.cleanupInterval.unref()
  }

  /**
   * Check if an email is currently locked out.
   * @returns remaining lockout seconds, or 0 if not locked
   */
  async isLocked(email: string): Promise<number> {
    const key = `login_lockout:${email}`

    if (this.redis) {
      try {
        const ttl = await this.redis.ttl(key)
        return ttl > 0 ? ttl : 0
      } catch {
        // Fall through to in-memory
      }
    }

    const entry = this.memoryStore.get(email)
    if (entry && entry.lockedUntil > Date.now()) {
      return Math.ceil((entry.lockedUntil - Date.now()) / 1000)
    }
    return 0
  }

  /**
   * Record a failed login attempt. Returns remaining attempts before lockout.
   * When attempts exhausted, account is locked for LOCKOUT_SECONDS.
   */
  async recordFailure(email: string): Promise<{ locked: boolean; remainingAttempts: number }> {
    const attemptsKey = `login_attempts:${email}`
    const lockoutKey = `login_lockout:${email}`

    if (this.redis) {
      try {
        const count = await this.redis.incr(attemptsKey)
        if (count === 1) {
          await this.redis.expire(attemptsKey, LOCKOUT_SECONDS)
        }

        if (count >= MAX_FAILED_ATTEMPTS) {
          await this.redis.setex(lockoutKey, LOCKOUT_SECONDS, '1')
          await this.redis.del(attemptsKey)
          logger.warn({ email, attempts: count }, 'Account locked due to too many failed login attempts')
          return { locked: true, remainingAttempts: 0 }
        }

        return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - count }
      } catch {
        // Fall through to in-memory
      }
    }

    // In-memory fallback
    const entry = this.memoryStore.get(email) ?? { count: 0, lockedUntil: 0, updatedAt: Date.now() }
    entry.count += 1
    entry.updatedAt = Date.now()

    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000
      entry.count = 0
      this.memoryStore.set(email, entry)
      logger.warn({ email, fallback: true }, 'Account locked due to too many failed login attempts (in-memory)')
      return { locked: true, remainingAttempts: 0 }
    }

    this.memoryStore.set(email, entry)
    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - entry.count }
  }

  /**
   * Clear failed attempts after a successful login.
   */
  async resetAttempts(email: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(`login_attempts:${email}`, `login_lockout:${email}`)
        return
      } catch {
        // Fall through to in-memory
      }
    }
    this.memoryStore.delete(email)
  }

  private cleanupMemory() {
    const now = Date.now()
    const staleThreshold = LOCKOUT_SECONDS * 1000
    for (const [key, entry] of this.memoryStore) {
      // Purge expired lockouts
      if (entry.lockedUntil > 0 && entry.lockedUntil < now) {
        this.memoryStore.delete(key)
      // Purge stale partial-attempt entries (user failed 1-4x then abandoned)
      } else if (entry.lockedUntil === 0 && now - entry.updatedAt > staleThreshold) {
        this.memoryStore.delete(key)
      }
    }
  }
}
