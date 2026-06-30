import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BookingVelocityStrategy } from '../../../../src/services/trending/booking-velocity.strategy'
import type { ScoringInput } from '../../../../src/services/trending/trending-scoring.strategy'
import type { BookingRepository } from '../../../../src/repositories/booking.repository'
import { TRENDING_SCORE_THRESHOLD } from '../../../../src/utils/constants'

// ── Mock repo ────────────────────────────────────────

function createMockBookingRepo() {
  return {
    aggregateBookingVelocity: vi.fn(),
  } as unknown as BookingRepository
}

// ── Helpers ──────────────────────────────────────────

const FAR_FUTURE = new Date('2099-01-01')  // no urgency bonus
const SOON = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)  // 5 days away → +5

function input(tripId: string, startDate = FAR_FUTURE): ScoringInput {
  return { tripId, startDate }
}

function velocityRow(tripId: string, week: number, month: number) {
  return { tripId, weekBookings: BigInt(week), monthBookings: BigInt(month) }
}

// ── Tests ────────────────────────────────────────────

describe('BookingVelocityStrategy', () => {
  let bookingRepo: BookingRepository
  let strategy: BookingVelocityStrategy

  beforeEach(() => {
    vi.clearAllMocks()
    bookingRepo = createMockBookingRepo()
    strategy = new BookingVelocityStrategy(bookingRepo)
  })

  describe('computeScores', () => {
    it('returns empty array for empty input without calling repo', async () => {
      const result = await strategy.computeScores([])

      expect(result).toEqual([])
      expect(bookingRepo.aggregateBookingVelocity).not.toHaveBeenCalled()
    })

    it('computes week score correctly (week × 10)', async () => {
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([
        velocityRow('trip-1', 2, 0),
      ])

      const [result] = await strategy.computeScores([input('trip-1')])

      expect(result.score).toBe(20)  // 2 × 10
    })

    it('computes month score correctly (month × 2)', async () => {
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([
        velocityRow('trip-1', 0, 3),
      ])

      const [result] = await strategy.computeScores([input('trip-1')])

      expect(result.score).toBe(6)  // 3 × 2
    })

    it('combines week + month without double-counting', async () => {
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([
        velocityRow('trip-1', 1, 1),
      ])

      const [result] = await strategy.computeScores([input('trip-1')])

      expect(result.score).toBe(12)  // (1 × 10) + (1 × 2)
    })

    it('adds urgency bonus (+5) when trip starts within 14 days', async () => {
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([
        velocityRow('trip-1', 1, 0),
      ])

      const [result] = await strategy.computeScores([input('trip-1', SOON)])

      expect(result.score).toBe(15)  // (1 × 10) + 5
    })

    it('does not apply urgency bonus when trip starts beyond 14 days', async () => {
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([
        velocityRow('trip-1', 1, 0),
      ])

      const [result] = await strategy.computeScores([input('trip-1', FAR_FUTURE)])

      expect(result.score).toBe(10)  // no urgency
    })

    it('does not apply urgency bonus for trips with past startDate', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([
        velocityRow('trip-1', 1, 0),
      ])

      const [result] = await strategy.computeScores([input('trip-1', pastDate)])

      expect(result.score).toBe(10)  // no urgency for past dates
    })

    it('returns score 0 for trips absent from the repo result (no bookings)', async () => {
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([])

      const [result] = await strategy.computeScores([input('trip-1')])

      expect(result).toEqual({ tripId: 'trip-1', score: 0 })
    })

    it('returns one score per input trip, including zero-booking trips', async () => {
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([
        velocityRow('trip-A', 3, 0),
        // trip-B absent — no bookings
      ])

      const results = await strategy.computeScores([input('trip-A'), input('trip-B')])

      expect(results).toHaveLength(2)
      expect(results.find((r) => r.tripId === 'trip-A')!.score).toBe(30)
      expect(results.find((r) => r.tripId === 'trip-B')!.score).toBe(0)
    })

    it('score at threshold makes a trip trending', async () => {
      // TRENDING_SCORE_THRESHOLD = 20 → need 2 week bookings
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockResolvedValue([
        velocityRow('trip-1', 2, 0),
      ])

      const [result] = await strategy.computeScores([input('trip-1')])

      expect(result.score).toBeGreaterThanOrEqual(TRENDING_SCORE_THRESHOLD)
    })

    it('propagates aggregation errors so the service can skip the DB write', async () => {
      vi.mocked(bookingRepo.aggregateBookingVelocity).mockRejectedValue(
        new Error('DB connection lost'),
      )

      await expect(strategy.computeScores([input('trip-1')])).rejects.toThrow('DB connection lost')
    })
  })
})
