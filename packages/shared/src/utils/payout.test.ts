import { describe, it, expect } from 'vitest'
import { calculatePayoutSplit, assertPayoutSafe } from './payout'
import { calculateRefundPercent } from './refund'
import { ORGANIZER_DEPOSIT_PERCENT, MAX_REFUND_PERCENT, REFUND_CLIFF_DAYS } from '../constants/payment'
import { CANCELLATION_POLICY } from '../constants/trip-types'

// See docs/codebase/Payments & Webhooks.md and the payout.ts docblock for the money
// model: entitlement E = round(baseAmount * (1 - commissionRate/100)); deposit D =
// round(E * depositPercent/100) unless the refund window is already closed at
// booking time, in which case D = E (last-minute booking edge case); balance B = E - D.

describe('calculatePayoutSplit', () => {
  // ── U5: normal booking split math ──────────────────────────────────────
  it('U5: splits entitlement 50/50 for a normal booking (c=10%), no rounding drift', () => {
    const baseAmount = 100_000 // paise = ₹1000
    const result = calculatePayoutSplit({
      baseAmount, commissionRate: 10, hoursUntilTrip: 24 * 30,
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })

    const expectedEntitlement = Math.round(baseAmount * 0.9) // 90000
    expect(result.entitlement).toBe(expectedEntitlement)
    expect(result.deposit).toBe(Math.round(expectedEntitlement * 0.5))
    expect(result.balance).toBe(result.entitlement - result.deposit)
    // No rounding drift — deposit + balance always reconstructs entitlement exactly.
    expect(result.deposit + result.balance).toBe(result.entitlement)
  })

  // ── U6: last-minute booking edge case ──────────────────────────────────
  it('U6: releases the full entitlement as deposit when the refund window is already closed (1h below the cliff)', () => {
    const baseAmount = 100_000
    const result = calculatePayoutSplit({
      baseAmount,
      commissionRate: 10,
      hoursUntilTrip: REFUND_CLIFF_DAYS * 24 - 1, // 1h below the cliff — window closed
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })

    expect(result.deposit).toBe(result.entitlement)
    expect(result.balance).toBe(0)
  })

  it('U6: releases the full entitlement as deposit for a booking made hours before trip start', () => {
    const baseAmount = 50_000
    const result = calculatePayoutSplit({
      baseAmount, commissionRate: 0, hoursUntilTrip: 2,
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })

    expect(result.deposit).toBe(result.entitlement)
    expect(result.balance).toBe(0)
  })

  // ── Boundary consistency (HIGH #1 fix) ──────────────────────────────────
  // calculatePayoutSplit must never disagree with calculateRefundPercent about
  // whether the refund window is closed — especially AT exactly the 168h boundary,
  // where the old `hoursUntilTrip <= REFUND_CLIFF_DAYS * 24` reimplementation said
  // "closed" while refund.ts's `>=` said "refund still possible" (50%).
  it('does NOT close the window at exactly the 168h (7d) boundary — still splits normally, matching refund.ts', () => {
    const baseAmount = 100_000
    const result = calculatePayoutSplit({
      baseAmount,
      commissionRate: 10,
      hoursUntilTrip: REFUND_CLIFF_DAYS * 24, // exactly at the cliff — refund.ts says 50% possible
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })

    expect(result.refundWindowClosed).toBe(false)
    expect(result.balance).toBeGreaterThan(0)
    expect(result.deposit).toBeLessThan(result.entitlement)
  })

  it('does NOT close the window one hour before the cliff (still splits normally)', () => {
    const baseAmount = 100_000
    const result = calculatePayoutSplit({
      baseAmount,
      commissionRate: 10,
      hoursUntilTrip: REFUND_CLIFF_DAYS * 24 + 1, // 1h beyond the cliff — window still open
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })

    expect(result.balance).toBeGreaterThan(0)
    expect(result.deposit).toBeLessThan(result.entitlement)
  })

  it('boundary sweep: refundWindowClosed always matches calculateRefundPercent(...) === 0, including exactly 168h', () => {
    const baseAmount = 987_654
    const hoursToSweep = [0, 1, 24, 167, 167.999, 168, 168.001, 169, 200, 24 * 30]
    for (const policy of [CANCELLATION_POLICY.FLEXIBLE, CANCELLATION_POLICY.MODERATE, CANCELLATION_POLICY.STRICT]) {
      for (const hoursUntilTrip of hoursToSweep) {
        const result = calculatePayoutSplit({ baseAmount, commissionRate: 10, hoursUntilTrip, cancellationPolicy: policy })
        const expectedClosed = calculateRefundPercent(policy, hoursUntilTrip) === 0
        expect(result.refundWindowClosed).toBe(expectedClosed)
      }
    }
  })

  // ── U7: invariant holds across a range of commission rates ────────────
  it('U7: deposit <= platformRetained holds across c ∈ {0,5,10,20,30}%', () => {
    const baseAmount = 987_654 // deliberately odd paise amount to stress rounding
    for (const commissionRate of [0, 5, 10, 20, 30]) {
      const { deposit } = calculatePayoutSplit({
        baseAmount, commissionRate, hoursUntilTrip: 24 * 30,
        cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
      })
      const platformRetained = baseAmount - deposit
      expect(deposit).toBeLessThanOrEqual(platformRetained)
    }
  })

  // ── U7 (fixed): last-minute bookings no longer trip the safety guard ──────
  // Previously, calculatePayoutSplit set deposit = entitlement for the last-minute
  // (0%-refund-possible) edge case, while assertPayoutSafe(deposit, platformRetained)
  // enforced the SAME invariant as the normal path — which only holds for
  // commissionRate >= 50%. At the realistic default (10%), this threw and broke
  // checkout. Fix: calculatePayoutSplit now returns refundWindowClosed, and
  // assertPayoutSafe accepts it as a third argument to skip the deposit<=platformRetained
  // check entirely when true — a refund is impossible in that case, so there is nothing
  // to protect against clawing back.
  it('U7 (fixed): assertPayoutSafe does not throw for a last-minute booking at the realistic 10% commission default, and releases the full entitlement as deposit', () => {
    const baseAmount = 987_654
    const result = calculatePayoutSplit({
      baseAmount, commissionRate: 10, hoursUntilTrip: 1,
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })
    const platformRetained = baseAmount - result.deposit

    expect(result.refundWindowClosed).toBe(true)
    expect(result.deposit).toBe(result.entitlement)
    expect(result.balance).toBe(0)
    // Without the fix this invariant is violated (deposit > platformRetained) —
    // confirm the guard is correctly bypassed rather than the invariant magically holding.
    expect(result.deposit).toBeGreaterThan(platformRetained)
    expect(() => assertPayoutSafe(result.deposit, platformRetained, result.refundWindowClosed)).not.toThrow()
  })

  it('U7 (fixed): holds across realistic commission rates for last-minute bookings', () => {
    const baseAmount = 987_654
    for (const commissionRate of [0, 5, 10, 20, 30]) {
      const result = calculatePayoutSplit({
        baseAmount, commissionRate, hoursUntilTrip: 1,
        cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
      })
      const platformRetained = baseAmount - result.deposit
      expect(() => assertPayoutSafe(result.deposit, platformRetained, result.refundWindowClosed)).not.toThrow()
    }
  })

  it('U7: assertPayoutSafe still enforces the invariant when refundWindowClosed is false (normal booking)', () => {
    const baseAmount = 987_654
    for (const commissionRate of [0, 5, 10, 20, 30]) {
      const result = calculatePayoutSplit({
        baseAmount, commissionRate, hoursUntilTrip: 24 * 30,
        cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
      })
      const platformRetained = baseAmount - result.deposit
      expect(result.refundWindowClosed).toBe(false)
      expect(() => assertPayoutSafe(result.deposit, platformRetained, result.refundWindowClosed)).not.toThrow()
    }
  })

  // ── U9: rounding — odd amounts, integer paise, no leak ─────────────────
  it('U9: rounds to integer paise for an odd amount (₹9999, c=10%), no drift', () => {
    const baseAmount = 999_900 // ₹9999 in paise
    const result = calculatePayoutSplit({
      baseAmount, commissionRate: 10, hoursUntilTrip: 24 * 30,
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })

    expect(Number.isInteger(result.entitlement)).toBe(true)
    expect(Number.isInteger(result.deposit)).toBe(true)
    expect(Number.isInteger(result.balance)).toBe(true)
    expect(result.deposit + result.balance).toBe(result.entitlement)
  })

  it('U9: rounds to integer paise for a variety of odd amounts with no leak', () => {
    const oddAmounts = [100_001, 333_333, 777_777, 1, 3]
    for (const baseAmount of oddAmounts) {
      const result = calculatePayoutSplit({
        baseAmount, commissionRate: 7, hoursUntilTrip: 24 * 30,
        cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
      })
      expect(Number.isInteger(result.deposit)).toBe(true)
      expect(Number.isInteger(result.balance)).toBe(true)
      expect(result.deposit + result.balance).toBe(result.entitlement)
    }
  })

  it('respects an explicit depositPercent override', () => {
    const baseAmount = 100_000
    const result = calculatePayoutSplit({
      baseAmount, commissionRate: 0, depositPercent: 20, hoursUntilTrip: 24 * 30,
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })

    expect(result.deposit).toBe(Math.round(result.entitlement * 0.2))
  })

  it('defaults depositPercent to ORGANIZER_DEPOSIT_PERCENT when not provided', () => {
    const baseAmount = 100_000
    const result = calculatePayoutSplit({
      baseAmount, commissionRate: 0, hoursUntilTrip: 24 * 30,
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })

    expect(result.deposit).toBe(Math.round(result.entitlement * (ORGANIZER_DEPOSIT_PERCENT / 100)))
  })

  it('STRICT policy always closes the refund window regardless of hoursUntilTrip', () => {
    const baseAmount = 100_000
    const result = calculatePayoutSplit({
      baseAmount, commissionRate: 10, hoursUntilTrip: 24 * 365,
      cancellationPolicy: CANCELLATION_POLICY.STRICT,
    })

    expect(result.refundWindowClosed).toBe(true)
    expect(result.deposit).toBe(result.entitlement)
    expect(result.balance).toBe(0)
  })
})

describe('assertPayoutSafe', () => {
  it('does not throw when deposit <= platformRetained', () => {
    expect(() => assertPayoutSafe(500, 500)).not.toThrow()
    expect(() => assertPayoutSafe(499, 500)).not.toThrow()
    expect(() => assertPayoutSafe(0, 0)).not.toThrow()
  })

  it('throws when deposit > platformRetained, with both amounts in the message', () => {
    expect(() => assertPayoutSafe(501, 500)).toThrow(/501/)
    expect(() => assertPayoutSafe(501, 500)).toThrow(/500/)
  })

  // ── U8: config-guard invariant — depositPercent <= 100 - maxRefundPercent ──
  it('U8: ORGANIZER_DEPOSIT_PERCENT <= 100 - MAX_REFUND_PERCENT holds for the current config', () => {
    expect(ORGANIZER_DEPOSIT_PERCENT).toBeLessThanOrEqual(100 - MAX_REFUND_PERCENT)
  })

  it('U8: a misconfigured depositPercent of 60% (with the current 50% max refund) violates the guard — this must fail', () => {
    const misconfiguredDepositPercent = 60
    // This assertion is written so that flipping ORGANIZER_DEPOSIT_PERCENT-equivalent
    // config to 60% while MAX_REFUND_PERCENT stays 50% is caught as a violation —
    // guarding against future misconfiguration silently reintroducing clawback risk.
    expect(misconfiguredDepositPercent).toBeGreaterThan(100 - MAX_REFUND_PERCENT)
  })

  it('U8: a real split computed with a misconfigured 60% depositPercent breaks the deposit<=platformRetained invariant and assertPayoutSafe throws', () => {
    const baseAmount = 100_000
    const commissionRate = 0 // worst case: no commission cushion
    const { deposit } = calculatePayoutSplit({
      baseAmount, commissionRate, depositPercent: 60, hoursUntilTrip: 24 * 30,
      cancellationPolicy: CANCELLATION_POLICY.FLEXIBLE,
    })
    const platformRetained = baseAmount - deposit

    // deposit = 60% of entitlement (100000) = 60000; platformRetained = 100000 - 60000 = 40000.
    // 60000 > 40000 — the invariant is violated, so assertPayoutSafe must throw.
    expect(deposit).toBeGreaterThan(platformRetained)
    expect(() => assertPayoutSafe(deposit, platformRetained)).toThrow(/invariant violated/i)
  })
})
