import { describe, it, expect } from 'vitest'
import { calculateRefundPercent, estimateRefund } from './refund'

// ── calculateRefundPercent ────────────────────────────────────────────────────
// Policy (7-day / 168h cliff, replaces the old 48h/100-50-0 tiers):
// FLEXIBLE / MODERATE: >=168h (7d) until trip → 50%; <168h → 0%
// STRICT: always 0%
// This cliff is deliberately aligned with the organizer deposit/balance payout split
// in utils/payout.ts — see refund.ts docblock.

describe('calculateRefundPercent', () => {
  describe('FLEXIBLE policy', () => {
    it('returns 50% at exactly 168h (7d) boundary', () => {
      expect(calculateRefundPercent('FLEXIBLE', 168)).toBe(50)
    })

    it('returns 50% above 168h', () => {
      expect(calculateRefundPercent('FLEXIBLE', 200)).toBe(50)
      expect(calculateRefundPercent('FLEXIBLE', 168.001)).toBe(50)
    })

    it('returns 0% below 168h', () => {
      expect(calculateRefundPercent('FLEXIBLE', 167.999)).toBe(0)
      expect(calculateRefundPercent('FLEXIBLE', 24)).toBe(0)
      expect(calculateRefundPercent('FLEXIBLE', 0)).toBe(0)
    })

    it('returns 0% for negative hours (trip already started)', () => {
      expect(calculateRefundPercent('FLEXIBLE', -1)).toBe(0)
    })
  })

  describe('MODERATE policy', () => {
    it('returns 50% at exactly 168h boundary', () => {
      expect(calculateRefundPercent('MODERATE', 168)).toBe(50)
    })

    it('returns 50% above 168h', () => {
      expect(calculateRefundPercent('MODERATE', 200)).toBe(50)
    })

    it('returns 0% below 168h', () => {
      expect(calculateRefundPercent('MODERATE', 167.999)).toBe(0)
      expect(calculateRefundPercent('MODERATE', 0)).toBe(0)
    })
  })

  describe('STRICT policy', () => {
    it('returns 0% regardless of time', () => {
      expect(calculateRefundPercent('STRICT', 300)).toBe(0)
      expect(calculateRefundPercent('STRICT', 168)).toBe(0)
      expect(calculateRefundPercent('STRICT', 0)).toBe(0)
    })
  })

  describe('unknown policy', () => {
    it('returns 0% for unrecognised value (defensive default)', () => {
      expect(calculateRefundPercent('UNKNOWN' as any, 300)).toBe(0)
    })
  })
})

// ── estimateRefund ────────────────────────────────────────────────────────────

describe('estimateRefund', () => {
  const FIXED_NOW = new Date('2025-06-14T10:00:00Z').getTime()
  const tripIn10d = new Date(FIXED_NOW + 10 * 24 * 60 * 60 * 1000).toISOString()
  const tripIn24h = new Date(FIXED_NOW + 24 * 60 * 60 * 1000).toISOString()

  it('returns correct percent and amount for FLEXIBLE >=168h (50%)', () => {
    const result = estimateRefund(9000, 'FLEXIBLE', tripIn10d, FIXED_NOW)
    expect(result.percent).toBe(50)
    expect(result.amount).toBe(4500)
  })

  it('returns correct percent and amount for FLEXIBLE <168h (0%)', () => {
    const result = estimateRefund(8000, 'FLEXIBLE', tripIn24h, FIXED_NOW)
    expect(result.percent).toBe(0)
    expect(result.amount).toBe(0)
  })

  it('rounds amount correctly for odd totalAmount (50% of 9001, >=168h)', () => {
    const result = estimateRefund(9001, 'FLEXIBLE', tripIn10d, FIXED_NOW)
    expect(result.percent).toBe(50)
    expect(result.amount).toBe(4501) // Math.round(9001 * 50 / 100) = Math.round(4500.5) = 4501
  })

  it('rounds amount correctly for odd totalAmount (50% of 8999, >=168h)', () => {
    const result = estimateRefund(8999, 'FLEXIBLE', tripIn10d, FIXED_NOW)
    expect(result.percent).toBe(50)
    expect(result.amount).toBe(4500) // Math.round(8999 * 50 / 100) = Math.round(4499.5) = 4500
  })

  it('accepts a Date object for tripStartDate', () => {
    const tripDate = new Date(FIXED_NOW + 10 * 24 * 60 * 60 * 1000)
    const result = estimateRefund(6000, 'FLEXIBLE', tripDate, FIXED_NOW)
    expect(result.percent).toBe(50)
    expect(result.amount).toBe(3000)
  })

  it('returns { percent: 0, amount: 0 } when tripStartDate is null', () => {
    const result = estimateRefund(9000, 'FLEXIBLE', null, FIXED_NOW)
    expect(result).toEqual({ percent: 0, amount: 0 })
  })

  it('returns { percent: 0, amount: 0 } when tripStartDate is undefined', () => {
    const result = estimateRefund(9000, 'FLEXIBLE', undefined, FIXED_NOW)
    expect(result).toEqual({ percent: 0, amount: 0 })
  })

  it('returns { percent: 0, amount: 0 } for STRICT regardless of timing', () => {
    const result = estimateRefund(5000, 'STRICT', tripIn10d, FIXED_NOW)
    expect(result).toEqual({ percent: 0, amount: 0 })
  })

  it('returns correct result for MODERATE >=168h (50%)', () => {
    const result = estimateRefund(10000, 'MODERATE', tripIn10d, FIXED_NOW)
    expect(result.percent).toBe(50)
    expect(result.amount).toBe(5000)
  })

  it('returns { percent: 0, amount: 0 } for MODERATE <168h', () => {
    const result = estimateRefund(10000, 'MODERATE', tripIn24h, FIXED_NOW)
    expect(result).toEqual({ percent: 0, amount: 0 })
  })

  it('uses Date.now() when now param is omitted (smoke test)', () => {
    const futureTripDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const result = estimateRefund(6000, 'FLEXIBLE', futureTripDate)
    expect(result.percent).toBe(50)
    expect(result.amount).toBe(3000)
  })
})
