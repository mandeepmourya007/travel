import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrendingScoreService } from '../../../../src/services/trending/trending-score.service'
import type { ITrendingScoringStrategy, TripScore } from '../../../../src/services/trending/trending-scoring.strategy'
import type { TripRepository } from '../../../../src/repositories/trip.repository'

// ── Mocks ────────────────────────────────────────────

function createMockStrategy(): ITrendingScoringStrategy {
  return { computeScores: vi.fn() }
}

function createMockTripRepo() {
  return {
    findActiveTripIdsForScoring: vi.fn(),
    batchUpdateTrendingScores: vi.fn(),
  } as unknown as TripRepository
}

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as import('pino').Logger

const TRIP_INPUT = [
  { tripId: 'trip-1', startDate: new Date('2099-01-01') },
  { tripId: 'trip-2', startDate: new Date('2099-06-01') },
]

const SCORES: TripScore[] = [
  { tripId: 'trip-1', score: 30 },
  { tripId: 'trip-2', score: 0 },
]

// ── Tests ────────────────────────────────────────────

describe('TrendingScoreService', () => {
  let strategy: ITrendingScoringStrategy
  let tripRepo: TripRepository
  let service: TrendingScoreService

  beforeEach(() => {
    vi.clearAllMocks()
    strategy = createMockStrategy()
    tripRepo = createMockTripRepo()
    service = new TrendingScoreService(strategy, tripRepo, mockLogger)
  })

  describe('recompute', () => {
    it('fetches trips, computes scores, and persists them', async () => {
      vi.mocked(tripRepo.findActiveTripIdsForScoring).mockResolvedValue(TRIP_INPUT)
      vi.mocked(strategy.computeScores).mockResolvedValue(SCORES)
      vi.mocked(tripRepo.batchUpdateTrendingScores).mockResolvedValue(undefined)

      await service.recompute()

      expect(tripRepo.findActiveTripIdsForScoring).toHaveBeenCalledOnce()
      expect(strategy.computeScores).toHaveBeenCalledWith(TRIP_INPUT)
      expect(tripRepo.batchUpdateTrendingScores).toHaveBeenCalledWith(SCORES)
    })

    it('returns early without calling strategy or repo when no active trips exist', async () => {
      vi.mocked(tripRepo.findActiveTripIdsForScoring).mockResolvedValue([])

      await service.recompute()

      expect(strategy.computeScores).not.toHaveBeenCalled()
      expect(tripRepo.batchUpdateTrendingScores).not.toHaveBeenCalled()
    })

    it('still calls batchUpdateTrendingScores when all scores are zero', async () => {
      const zeroScores: TripScore[] = [{ tripId: 'trip-1', score: 0 }]
      vi.mocked(tripRepo.findActiveTripIdsForScoring).mockResolvedValue([TRIP_INPUT[0]])
      vi.mocked(strategy.computeScores).mockResolvedValue(zeroScores)
      vi.mocked(tripRepo.batchUpdateTrendingScores).mockResolvedValue(undefined)

      await service.recompute()

      // Zero scores must still be written so previously-trending trips lose their badge
      expect(tripRepo.batchUpdateTrendingScores).toHaveBeenCalledWith(zeroScores)
    })

    it('propagates strategy errors — batchUpdateTrendingScores is never called', async () => {
      vi.mocked(tripRepo.findActiveTripIdsForScoring).mockResolvedValue(TRIP_INPUT)
      vi.mocked(strategy.computeScores).mockRejectedValue(new Error('DB connection lost'))

      await expect(service.recompute()).rejects.toThrow('DB connection lost')
      expect(tripRepo.batchUpdateTrendingScores).not.toHaveBeenCalled()
    })

    it('propagates repo write errors', async () => {
      vi.mocked(tripRepo.findActiveTripIdsForScoring).mockResolvedValue(TRIP_INPUT)
      vi.mocked(strategy.computeScores).mockResolvedValue(SCORES)
      vi.mocked(tripRepo.batchUpdateTrendingScores).mockRejectedValue(new Error('write failed'))

      await expect(service.recompute()).rejects.toThrow('write failed')
    })
  })
})
