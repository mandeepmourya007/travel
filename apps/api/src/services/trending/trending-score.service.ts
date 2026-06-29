import type { Logger } from 'pino'
import type { ITrendingScoringStrategy } from './trending-scoring.strategy'
import type { TripRepository } from '../../repositories/trip.repository'

/**
 * Context (GoF Strategy Pattern) — delegates scoring to an injected strategy.
 *
 * This service is algorithm-agnostic:
 * - Today: BookingVelocityStrategy (recent confirmed bookings)
 * - Future: HybridStrategy, MLStrategy, etc. — swap in dependencies.ts only.
 *
 * Responsibility: fetch eligible trips → score → persist. Nothing else.
 */
export class TrendingScoreService {
  constructor(
    private strategy: ITrendingScoringStrategy,
    private tripRepo: TripRepository,
    private logger: Logger,
  ) {}

  async recompute(): Promise<void> {
    const trips = await this.tripRepo.findActiveTripIdsForScoring()
    if (trips.length === 0) {
      this.logger.info('TrendingScoreService: no active trips to score')
      return
    }

    this.logger.info({ count: trips.length }, 'TrendingScoreService: computing scores')

    const scores = await this.strategy.computeScores(trips)
    await this.tripRepo.batchUpdateTrendingScores(scores)

    const nonZero = scores.filter((s) => s.score > 0).length
    this.logger.info({ total: scores.length, nonZero }, 'TrendingScoreService: scores persisted')
  }
}
