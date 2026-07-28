/**
 * buildIdempotencyKey unit tests.
 *
 * RazorpayX's X-Payout-Idempotency header has a documented 36-character limit,
 * so the key is a truncated sha256 hex digest (see src/utils/idempotency.ts).
 * These tests pin down: output length, determinism, distinctness, and that the
 * `:` join separator prevents part-boundary collisions (e.g. ('a','b') vs ('ab')).
 */
import { describe, it, expect } from 'vitest'
import { buildIdempotencyKey } from '../../../src/utils/idempotency'

describe('buildIdempotencyKey', () => {
  it('returns a key no longer than 36 characters (RazorpayX X-Payout-Idempotency limit)', () => {
    const key = buildIdempotencyKey('booking-123', 'release', Date.now())
    expect(key.length).toBeLessThanOrEqual(36)
  })

  it('returns exactly 32 hex characters', () => {
    const key = buildIdempotencyKey('booking-123', 'release')
    expect(key).toHaveLength(32)
    expect(key).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is deterministic — same parts always produce the same key', () => {
    const key1 = buildIdempotencyKey('booking-123', 'release', 42)
    const key2 = buildIdempotencyKey('booking-123', 'release', 42)
    const key3 = buildIdempotencyKey('booking-123', 'release', 42)

    expect(key1).toBe(key2)
    expect(key2).toBe(key3)
  })

  it('produces different keys for different parts', () => {
    const key1 = buildIdempotencyKey('booking-123', 'release')
    const key2 = buildIdempotencyKey('booking-456', 'release')
    const key3 = buildIdempotencyKey('booking-123', 'refund')

    expect(key1).not.toBe(key2)
    expect(key1).not.toBe(key3)
    expect(key2).not.toBe(key3)
  })

  it('prevents part-boundary collisions via the ":" join separator — ("a","b") !== ("ab")', () => {
    const splitParts = buildIdempotencyKey('a', 'b')
    const joinedPart = buildIdempotencyKey('ab')

    expect(splitParts).not.toBe(joinedPart)
  })

  it('prevents part-boundary collisions across a three-part split too — ("a","b","c") !== ("a","bc") !== ("ab","c")', () => {
    const threeParts = buildIdempotencyKey('a', 'b', 'c')
    const mergedLast = buildIdempotencyKey('a', 'bc')
    const mergedFirst = buildIdempotencyKey('ab', 'c')

    expect(threeParts).not.toBe(mergedLast)
    expect(threeParts).not.toBe(mergedFirst)
    expect(mergedLast).not.toBe(mergedFirst)
  })

  it('distinguishes numeric parts from their string representation position', () => {
    const key1 = buildIdempotencyKey('booking-1', 2, 3)
    const key2 = buildIdempotencyKey('booking-1', 23)

    expect(key1).not.toBe(key2)
  })
})
