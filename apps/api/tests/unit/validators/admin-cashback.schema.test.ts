import { describe, it, expect } from 'vitest'
import {
  cashbackTripFiltersSchema,
  issueCashbackSchema,
  cashbackHistoryFiltersSchema,
} from '@shared/validators/admin.schema'

// ═══════════════════════════════════════════════════════
// cashbackTripFiltersSchema
// ═══════════════════════════════════════════════════════
describe('cashbackTripFiltersSchema', () => {
  it('passes with no params (all optional + defaults)', () => {
    const result = cashbackTripFiltersSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
      expect(result.data.search).toBeUndefined()
    }
  })

  it('passes with valid search + page + limit', () => {
    const result = cashbackTripFiltersSchema.safeParse({ search: 'goa', page: 2, limit: 10 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.search).toBe('goa')
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(10)
    }
  })

  it('coerces string page/limit to numbers (query params)', () => {
    const result = cashbackTripFiltersSchema.safeParse({ page: '3', limit: '15' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(15)
    }
  })

  it('trims search string', () => {
    const result = cashbackTripFiltersSchema.safeParse({ search: '  goa beach  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.search).toBe('goa beach')
    }
  })

  it('rejects page < 1', () => {
    expect(cashbackTripFiltersSchema.safeParse({ page: 0 }).success).toBe(false)
    expect(cashbackTripFiltersSchema.safeParse({ page: -1 }).success).toBe(false)
  })

  it('rejects limit > 50', () => {
    expect(cashbackTripFiltersSchema.safeParse({ limit: 51 }).success).toBe(false)
  })

  it('rejects limit < 1', () => {
    expect(cashbackTripFiltersSchema.safeParse({ limit: 0 }).success).toBe(false)
  })

  it('rejects search > 100 chars', () => {
    const result = cashbackTripFiltersSchema.safeParse({ search: 'x'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer page', () => {
    expect(cashbackTripFiltersSchema.safeParse({ page: 1.5 }).success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════
// issueCashbackSchema
// ═══════════════════════════════════════════════════════
describe('issueCashbackSchema', () => {
  const validUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  const validPayload = {
    tripId: validUuid,
    items: [
      { bookingId: validUuid, userId: validUuid, amount: 200 },
    ],
  }

  it('passes with valid single-item payload', () => {
    const result = issueCashbackSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('passes with multiple items', () => {
    const result = issueCashbackSchema.safeParse({
      tripId: validUuid,
      items: [
        { bookingId: validUuid, userId: validUuid, amount: 200 },
        { bookingId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', userId: validUuid, amount: 300 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = issueCashbackSchema.safeParse({ tripId: validUuid, items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing tripId', () => {
    const result = issueCashbackSchema.safeParse({ items: validPayload.items })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID tripId', () => {
    const result = issueCashbackSchema.safeParse({ ...validPayload, tripId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID bookingId', () => {
    const result = issueCashbackSchema.safeParse({
      tripId: validUuid,
      items: [{ bookingId: 'bad', userId: validUuid, amount: 100 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID userId', () => {
    const result = issueCashbackSchema.safeParse({
      tripId: validUuid,
      items: [{ bookingId: validUuid, userId: 'bad', amount: 100 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero amount', () => {
    const result = issueCashbackSchema.safeParse({
      tripId: validUuid,
      items: [{ bookingId: validUuid, userId: validUuid, amount: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = issueCashbackSchema.safeParse({
      tripId: validUuid,
      items: [{ bookingId: validUuid, userId: validUuid, amount: -100 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer amount (decimal)', () => {
    const result = issueCashbackSchema.safeParse({
      tripId: validUuid,
      items: [{ bookingId: validUuid, userId: validUuid, amount: 99.5 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing amount field', () => {
    const result = issueCashbackSchema.safeParse({
      tripId: validUuid,
      items: [{ bookingId: validUuid, userId: validUuid }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects items without required fields', () => {
    const result = issueCashbackSchema.safeParse({
      tripId: validUuid,
      items: [{ bookingId: validUuid }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects entire payload as empty object', () => {
    expect(issueCashbackSchema.safeParse({}).success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════
// cashbackHistoryFiltersSchema
// ═══════════════════════════════════════════════════════
describe('cashbackHistoryFiltersSchema', () => {
  it('passes with no params and applies defaults', () => {
    const result = cashbackHistoryFiltersSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('coerces string values to numbers', () => {
    const result = cashbackHistoryFiltersSchema.safeParse({ page: '2', limit: '30' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(30)
    }
  })

  it('rejects page < 1', () => {
    expect(cashbackHistoryFiltersSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('rejects limit > 50', () => {
    expect(cashbackHistoryFiltersSchema.safeParse({ limit: 51 }).success).toBe(false)
  })

  it('rejects non-integer values', () => {
    expect(cashbackHistoryFiltersSchema.safeParse({ page: 1.5 }).success).toBe(false)
    expect(cashbackHistoryFiltersSchema.safeParse({ limit: 2.5 }).success).toBe(false)
  })
})
