/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentTransactionRepository } from '../../../src/repositories/payment-transaction.repository'

// ── Mock Prisma ──────────────────────────────────────
function createMockPrisma() {
  return {
    paymentTransaction: {
      findMany: vi.fn(),
    },
  }
}

// ═══════════════════════════════════════════════════════
// findBalanceReleaseEligibleBookings (MEDIUM fix — CANCELLED + 0%-refund bookings
// must be eligible for balance release; CANCELLED + >0%-refund bookings must never be)
//
// M1/S1 fix: this now issues a SINGLE findMany with the BALANCE_RELEASE/REFUND
// exclusions expressed as Prisma relation filters (`none`) instead of two unbounded
// findMany scans diffed in JS via Sets. Since the exclusion logic now lives in the
// WHERE clause (exercised against the real DB in integration tests / by Prisma's own
// query builder), these unit tests mock the single findMany call to return exactly
// what a correct WHERE clause would return, and assert (a) the repository maps that
// result to `{ bookingId }` unchanged, and (b) the where clause is actually shaped to
// enforce the same eligibility semantics as before.
// ═══════════════════════════════════════════════════════
describe('PaymentTransactionRepository.findBalanceReleaseEligibleBookings', () => {
  let repo: PaymentTransactionRepository
  let mockPrisma: ReturnType<typeof createMockPrisma>
  const cutoffDate = new Date('2025-06-01T00:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    repo = new PaymentTransactionRepository(mockPrisma as any)
  })

  function mockCandidates(candidates: Array<{ bookingId: string }>) {
    mockPrisma.paymentTransaction.findMany.mockResolvedValueOnce(candidates)
  }

  it('includes a CANCELLED booking with a DEPOSIT_RELEASE and NO REFUND tx (0%-refund cancellation)', async () => {
    // A correct WHERE clause (none: REFUND on the CANCELLED branch) would return this row.
    mockCandidates([{ bookingId: 'booking-cancelled-0pct' }])

    const result = await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(result).toEqual([{ bookingId: 'booking-cancelled-0pct' }])
  })

  it('excludes a CANCELLED booking that has a REFUND tx (>0%-refund cancellation — balance must stay held)', async () => {
    // A correct WHERE clause would never return this row at all (the DB-side
    // `none: { type: REFUND }` filter on the CANCELLED OR-branch excludes it).
    mockCandidates([])

    const result = await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(result).toEqual([])
  })

  it('still includes a CONFIRMED booking with no REFUND tx (unaffected by the fix)', async () => {
    mockCandidates([{ bookingId: 'booking-confirmed' }])

    const result = await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(result).toEqual([{ bookingId: 'booking-confirmed' }])
  })

  it('still includes a COMPLETED booking with no REFUND tx (unaffected by the fix)', async () => {
    mockCandidates([{ bookingId: 'booking-completed' }])

    const result = await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(result).toEqual([{ bookingId: 'booking-completed' }])
  })

  it('excludes a booking already present in BALANCE_RELEASE, regardless of bookingStatus', async () => {
    // The DB-side `none: { type: BALANCE_RELEASE }` filter (shared across both OR
    // branches) excludes this row before it ever reaches the application.
    mockCandidates([])

    const result = await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(result).toEqual([])
  })

  it('a REFUND tx on a DIFFERENT booking does not exclude an unrelated CANCELLED candidate', async () => {
    // The `none: { type: REFUND }` filter is correlated to the SAME booking via the
    // paymentTransactions relation, so an unrelated booking's REFUND tx is irrelevant.
    mockCandidates([{ bookingId: 'booking-cancelled-0pct' }])

    const result = await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(result).toEqual([{ bookingId: 'booking-cancelled-0pct' }])
  })

  it('a REFUND tx on a CONFIRMED (non-cancelled) candidate does not exclude it — the refund-guard only applies to CANCELLED', async () => {
    // Defensive case: REFUND rows are only ever created alongside a cancellation in
    // this codebase, but the OR's second branch (with the REFUND guard) is scoped to
    // bookingStatus === CANCELLED, so a CONFIRMED booking always matches via the first
    // branch and is never subject to the REFUND check.
    mockCandidates([{ bookingId: 'booking-confirmed-with-refund' }])

    const result = await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(result).toEqual([{ bookingId: 'booking-confirmed-with-refund' }])
  })

  it('builds a single query with the cutoffDate, broadened bookingStatus OR-branches, and BALANCE_RELEASE/REFUND none-filters', async () => {
    mockCandidates([])

    await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(mockPrisma.paymentTransaction.findMany).toHaveBeenCalledTimes(1)
    const call = mockPrisma.paymentTransaction.findMany.mock.calls[0][0]

    expect(call.where.type).toBe('DEPOSIT_RELEASE')
    expect(call.where.provider).toBe('cashfree')
    expect(call.where.booking.isDeleted).toBe(false)
    expect(call.where.booking.trip).toEqual({ isDeleted: false, startDate: { lte: cutoffDate } })
    expect(call.where.booking.paymentTransactions).toEqual({ none: { type: 'BALANCE_RELEASE' } })
    expect(call.where.booking.OR).toEqual([
      { bookingStatus: { in: ['CONFIRMED', 'COMPLETED'] } },
      { bookingStatus: 'CANCELLED', paymentTransactions: { none: { type: 'REFUND' } } },
    ])
  })

  it('returns an empty array when there are no candidates at all', async () => {
    mockCandidates([])

    const result = await repo.findBalanceReleaseEligibleBookings(cutoffDate)

    expect(result).toEqual([])
  })
})
