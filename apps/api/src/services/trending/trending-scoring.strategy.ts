/**
 * Strategy Pattern — ITrendingScoringStrategy
 *
 * Defines the contract for all trending score algorithms.
 * TrendingScoreService (the context) calls computeScores() without knowing
 * which concrete strategy is active — swap strategies in dependencies.ts.
 *
 * Design rules for implementors:
 * - Receive pre-fetched ScoringInput (trip ID + metadata); fetch additional
 *   data (e.g. booking counts) inside computeScores() via injected clients.
 * - Never call other domain services — query DB or external APIs directly.
 * - Return one TripScore per input trip; score of 0 is valid (no recent activity).
 * - Must not throw — catch internal errors and return score: 0 for that trip.
 */

export interface ScoringInput {
  tripId: string
  startDate: Date
}

export interface TripScore {
  tripId: string
  score: number
}

export interface ITrendingScoringStrategy {
  /**
   * Compute a trending score for each eligible trip.
   *
   * @param trips - Active/Full trips to score (pre-fetched by TrendingScoreService)
   * @returns Scores in the same order as input; one entry per trip
   */
  computeScores(trips: ScoringInput[]): Promise<TripScore[]>
}
