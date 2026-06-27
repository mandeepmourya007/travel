import { describe, it, expect } from 'vitest'
import {
  idSchema,
  cuidParamSchema,
  tripIdParamSchema,
  bookingIdParamSchema,
  tripRequestParamSchema,
  organizerIdParamSchema,
} from '@shared/validators/common.schema'

// ═══════════════════════════════════════════════════════
// idSchema — accepts cuid v1 (25 chars) and any UUID format
// ═══════════════════════════════════════════════════════

describe('idSchema', () => {
  // ── Valid inputs ──────────────────────────────────────
  describe('valid inputs', () => {
    it('accepts a valid cuid v1 (25 chars, c-prefix)', () => {
      // Prisma @default(cuid()) generates this format
      expect(idSchema.safeParse('clh3k2abc0001234567890abc').success).toBe(true)
    })

    it('accepts a UUIDv7 (current @default(uuid(7)) format)', () => {
      expect(idSchema.safeParse('01926c8d-7f7e-7b7e-8b8e-9c9d9e9f0a0b').success).toBe(true)
    })

    it('accepts a UUIDv4 (legacy rows or external IDs)', () => {
      expect(idSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true)
    })

    it('accepts UUID in uppercase (case-insensitive flag)', () => {
      expect(idSchema.safeParse('550E8400-E29B-41D4-A716-446655440000').success).toBe(true)
    })
  })

  // ── Invalid inputs ────────────────────────────────────
  describe('invalid inputs', () => {
    it('rejects empty string', () => {
      expect(idSchema.safeParse('').success).toBe(false)
    })

    it('rejects a cuid that is too short (24 chars total, one char short)', () => {
      // 'c' + 23 chars = 24 total — too short for cuid v1
      expect(idSchema.safeParse('clh3k2abc001234567890ab').success).toBe(false)
    })

    it('rejects a cuid that is too long (26 chars total, one char over)', () => {
      // 'c' + 25 chars = 26 total — one char over cuid v1
      expect(idSchema.safeParse('clh3k2abc0001234567890abcd').success).toBe(false)
    })

    it('rejects a string that starts with c but contains uppercase (cuid is lowercase-only)', () => {
      // cuid v1 is strictly lowercase alphanumeric after the 'c' prefix
      expect(idSchema.safeParse('cLH3K2ABC0001234567890AB').success).toBe(false)
    })

    it('rejects a UUID missing hyphens', () => {
      expect(idSchema.safeParse('550e8400e29b41d4a716446655440000').success).toBe(false)
    })

    it('rejects a UUID with wrong segment lengths', () => {
      expect(idSchema.safeParse('550e8400-e29b-41d4-a716-44665544000').success).toBe(false)
    })

    it('rejects arbitrary slug-style strings', () => {
      expect(idSchema.safeParse('goa-beach-getaway').success).toBe(false)
    })

    it('rejects a plain number string', () => {
      expect(idSchema.safeParse('12345').success).toBe(false)
    })

    it('rejects undefined', () => {
      expect(idSchema.safeParse(undefined).success).toBe(false)
    })

    it('returns the "Invalid id" error message on failure', () => {
      const result = idSchema.safeParse('bad-id')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid id')
      }
    })
  })
})

// ═══════════════════════════════════════════════════════
// Param schemas that wrap idSchema — verify they accept
// both cuid v1 and UUID formats after the migration
// ═══════════════════════════════════════════════════════

const CUID = 'clh3k2abc0001234567890abc'
const UUID = '01926c8d-7f7e-7b7e-8b8e-9c9d9e9f0a0b'

describe('cuidParamSchema', () => {
  it('accepts a cuid v1 in { id }', () => {
    expect(cuidParamSchema.safeParse({ id: CUID }).success).toBe(true)
  })

  it('accepts a UUIDv7 in { id }', () => {
    expect(cuidParamSchema.safeParse({ id: UUID }).success).toBe(true)
  })

  it('rejects garbage in { id }', () => {
    expect(cuidParamSchema.safeParse({ id: 'not-an-id' }).success).toBe(false)
  })
})

describe('tripIdParamSchema', () => {
  it('accepts cuid v1 in { tripId }', () => {
    expect(tripIdParamSchema.safeParse({ tripId: CUID }).success).toBe(true)
  })

  it('accepts UUIDv7 in { tripId }', () => {
    expect(tripIdParamSchema.safeParse({ tripId: UUID }).success).toBe(true)
  })

  it('rejects missing tripId', () => {
    expect(tripIdParamSchema.safeParse({}).success).toBe(false)
  })
})

describe('bookingIdParamSchema', () => {
  it('accepts cuid v1 in { bookingId }', () => {
    expect(bookingIdParamSchema.safeParse({ bookingId: CUID }).success).toBe(true)
  })

  it('accepts UUIDv7 in { bookingId }', () => {
    expect(bookingIdParamSchema.safeParse({ bookingId: UUID }).success).toBe(true)
  })
})

describe('tripRequestParamSchema', () => {
  it('accepts cuid v1 for both tripId and requestId', () => {
    expect(tripRequestParamSchema.safeParse({ tripId: CUID, requestId: CUID }).success).toBe(true)
  })

  it('accepts mixed: UUID tripId + cuid requestId', () => {
    expect(tripRequestParamSchema.safeParse({ tripId: UUID, requestId: CUID }).success).toBe(true)
  })

  it('rejects when either field is invalid', () => {
    expect(tripRequestParamSchema.safeParse({ tripId: UUID, requestId: 'bad' }).success).toBe(false)
    expect(tripRequestParamSchema.safeParse({ tripId: 'bad', requestId: CUID }).success).toBe(false)
  })
})

describe('organizerIdParamSchema', () => {
  it('accepts UUIDv7 in { organizerId }', () => {
    expect(organizerIdParamSchema.safeParse({ organizerId: UUID }).success).toBe(true)
  })

  it('accepts cuid v1 in { organizerId }', () => {
    expect(organizerIdParamSchema.safeParse({ organizerId: CUID }).success).toBe(true)
  })
})
