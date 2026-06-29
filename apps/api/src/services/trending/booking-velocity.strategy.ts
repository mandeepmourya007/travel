import type { Logger } from 'pino'
import type { ITrendingScoringStrategy, ScoringInput, TripScore } from './trending-scoring.strategy'
import type { BookingRepository } from '../../repositories/booking.repository'

// ── Score weights ────────────────────────────────────────────────────────────
// The 7-day and 8-30-day windows are mutually exclusive buckets so weights
// are additive without double-counting:
//   - 0–7 days:   × 10  (strong recency signal — trip is heating up)
//   - 8–30 days:  × 2   (sustained momentum from the past month)
//   - Urgency:    + 5   (trip starts within 14 days — decision window closing)
const WEIGHT_WEEK = 10
const WEIGHT_MONTH = 2
const URGENCY_BONUS = 5
const URGENCY_DAYS = 14

/**
 * Scores trips by booking velocity: recent bookings dominate, older ones add
 * momentum, and trips starting within 14 days receive an urgency bonus.
 *
 * Formula:
 *   score = (bookings_0_to_7d × 10) + (bookings_8_to_30d × 2)
 *         + (startDate within 14 days ? 5 : 0)
 *
 * Delegates the aggregation SQL to BookingRepository.aggregateBookingVelocity()
 * so this strategy touches zero raw Prisma — all DB access goes through the repo layer.
 *
 * Business rules:
 * - Only CONFIRMED bookings count — PENDING_PAYMENT and CANCELLED are excluded.
 * - Soft-deleted bookings (isDeleted=true) are excluded.
 * - Trips with zero recent bookings receive score 0 (not null).
 */
export class BookingVelocityStrategy implements ITrendingScoringStrategy {
  constructor(
    private bookingRepo: BookingRepository,
    private logger: Logger,
  ) {}

  async computeScores(trips: ScoringInput[]): Promise<TripScore[]> {
    if (trips.length === 0) return []

    const tripIds = trips.map((t) => t.tripId)
    const now = new Date()

    try {
      const rows = await this.bookingRepo.aggregateBookingVelocity(tripIds)

      const rowMap = new Map(rows.map((r) => [r.tripId, r]))

      return trips.map(({ tripId, startDate }) => {
        const row = rowMap.get(tripId)
        const weekBookings = Number(row?.weekBookings ?? 0n)
        const monthBookings = Number(row?.monthBookings ?? 0n)

        const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / 86_400_000)
        const urgency = daysUntilStart > 0 && daysUntilStart <= URGENCY_DAYS ? URGENCY_BONUS : 0

        const score = weekBookings * WEIGHT_WEEK + monthBookings * WEIGHT_MONTH + urgency
        return { tripId, score }
      })
    } catch (err) {
      this.logger.error({ err }, 'BookingVelocityStrategy: aggregation failed — returning zero scores')
      return trips.map(({ tripId }) => ({ tripId, score: 0 }))
    }
  }
}
