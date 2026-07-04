/**
 * FEATURE BRIEF: Reviews & Comments (Swiggy/Zomato/MMT style)
 * ==================================
 * 1. What:      Star reviews (1-5) with optional comment, photos, organizer reply, editing
 * 2. Who:       Traveler (create/edit review), Organizer (reply)
 * 3. Why:       Trust signal, social proof, quality enforcement
 *
 * 4. API Endpoints:
 *    POST /api/v1/reviews                             — create review (traveler)
 *    PUT  /api/v1/reviews/:id                         — edit review within 30 days
 *    POST /api/v1/reviews/:id/reply                   — organizer reply
 *    GET  /api/v1/reviews/trip/:tripId                — public list with summary
 *    GET  /api/v1/reviews/my/booking/:bookingId       — get own review
 *    GET  /api/v1/reviews/organizer/mine              — organizer dashboard reviews
 *    GET  /api/v1/reviews/my                          — traveler's own reviews
 *
 * 5. DB Tables:  Review (updated), OrganizerProfile (rating cache)
 * 6. Validations: rating 1-5, comment max 2000, photos max 5
 * 7. Error Cases: Not found, forbidden (wrong owner/no profile), validation (not completed), conflict (duplicate)
 * 8. Side Effects: OrganizerProfile.rating + totalReviews recalculated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewService } from '../../../src/services/review.service'
import { logger } from '../../../src/utils/logger'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../../src/errors/app-error'

// ─── Mock repositories ──────────────────────────────
const mockReviewRepo = {
  findBookingForReview: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  findByBookingId: vi.fn(),
  findByTripId: vi.fn(),
  update: vi.fn(),
  updateOrganizerReply: vi.fn(),
  getOrganizerRatingStats: vi.fn(),
  getRatingDistribution: vi.fn(),
  findByOrganizerIdWithFilters: vi.fn(),
  findAllByUserId: vi.fn(),
}

const mockOrganizerProfileRepo = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  incrementTripCount: vi.fn(),
}

let service: ReviewService

beforeEach(() => {
  vi.clearAllMocks()
  service = new ReviewService(
    mockReviewRepo as any,
    mockOrganizerProfileRepo as any,
    logger as any,
  )
})

// ─── Test data factories ─────────────────────────────
function makeBookingForReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking_1',
    userId: 'user_1',
    bookingStatus: 'COMPLETED',
    tripId: 'trip_1',
    trip: { organizerId: 'org_1' },
    ...overrides,
  }
}

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review_1',
    tripId: 'trip_1',
    bookingId: 'booking_1',
    userId: 'user_1',
    overallRating: 4,
    organizationRating: null,
    valueRating: null,
    safetyRating: null,
    accuracyRating: null,
    comment: 'Great trip!',
    photos: [],
    editedAt: null,
    organizerReply: null,
    organizerReplyAt: null,
    createdAt: new Date('2025-06-01'),
    user: { id: 'user_1', name: 'Test User', avatarUrl: null },
    trip: { organizerId: 'org_1' },
    ...overrides,
  }
}

// ─── createReview ────────────────────────────────────

describe('ReviewService', () => {
  describe('createReview', () => {
    const dto = {
      tripId: 'trip_1',
      bookingId: 'booking_1',
      overallRating: 5,
      comment: 'Amazing experience!',
    }

    it('should create a review for a completed booking and recalculate organizer rating', async () => {
      mockReviewRepo.findBookingForReview.mockResolvedValue(makeBookingForReview())
      mockReviewRepo.findByBookingId.mockResolvedValue(null)
      mockReviewRepo.create.mockResolvedValue(makeReview({ overallRating: 5 }))
      mockReviewRepo.getOrganizerRatingStats.mockResolvedValue({
        _avg: { overallRating: 4.5 },
        _count: { overallRating: 3 },
      })
      mockOrganizerProfileRepo.update.mockResolvedValue({})

      const result = await service.createReview('user_1', dto)

      expect(result.overallRating).toBe(5)
      expect(mockReviewRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        tripId: 'trip_1',
        bookingId: 'booking_1',
        userId: 'user_1',
        overallRating: 5,
      }))
      expect(mockOrganizerProfileRepo.update).toHaveBeenCalledWith('org_1', {
        rating: 4.5,
        totalReviews: 3,
      })
    })

    it('should throw NotFoundError when booking does not exist', async () => {
      mockReviewRepo.findBookingForReview.mockResolvedValue(null)

      await expect(service.createReview('user_1', dto)).rejects.toThrow(NotFoundError)
    })

    it('should throw ForbiddenError when booking belongs to another user', async () => {
      mockReviewRepo.findBookingForReview.mockResolvedValue(
        makeBookingForReview({ userId: 'other_user' }),
      )

      await expect(service.createReview('user_1', dto)).rejects.toThrow(ForbiddenError)
    })

    it('should throw ValidationError when booking is not COMPLETED', async () => {
      mockReviewRepo.findBookingForReview.mockResolvedValue(
        makeBookingForReview({ bookingStatus: 'CONFIRMED' }),
      )

      await expect(service.createReview('user_1', dto)).rejects.toThrow(ValidationError)
    })

    it('should throw ConflictError when review already exists for the booking', async () => {
      mockReviewRepo.findBookingForReview.mockResolvedValue(makeBookingForReview())
      mockReviewRepo.findByBookingId.mockResolvedValue(makeReview())

      await expect(service.createReview('user_1', dto)).rejects.toThrow(ConflictError)
    })
  })

  // ─── updateReview ────────────────────────────────────

  describe('updateReview', () => {
    it('should update a review within the edit window and set editedAt', async () => {
      const review = makeReview({ createdAt: new Date() })
      mockReviewRepo.findById.mockResolvedValue(review)
      mockReviewRepo.update.mockResolvedValue({ ...review, overallRating: 3, editedAt: new Date() })
      mockReviewRepo.getOrganizerRatingStats.mockResolvedValue({
        _avg: { overallRating: 3.5 },
        _count: { overallRating: 2 },
      })
      mockOrganizerProfileRepo.update.mockResolvedValue({})

      const result = await service.updateReview('user_1', 'review_1', { overallRating: 3 })

      expect(result.overallRating).toBe(3)
      expect(mockReviewRepo.update).toHaveBeenCalledWith('review_1', { overallRating: 3 })
    })

    it('should throw NotFoundError when review does not exist', async () => {
      mockReviewRepo.findById.mockResolvedValue(null)

      await expect(service.updateReview('user_1', 'review_1', { overallRating: 3 }))
        .rejects.toThrow(NotFoundError)
    })

    it('should throw ForbiddenError when review belongs to another user', async () => {
      mockReviewRepo.findById.mockResolvedValue(makeReview({ userId: 'other_user' }))

      await expect(service.updateReview('user_1', 'review_1', { overallRating: 3 }))
        .rejects.toThrow(ForbiddenError)
    })

    it('should throw ValidationError when edit window has expired (>30 days)', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 31)
      mockReviewRepo.findById.mockResolvedValue(makeReview({ createdAt: oldDate }))

      await expect(service.updateReview('user_1', 'review_1', { overallRating: 3 }))
        .rejects.toThrow(ValidationError)
    })

    it('should not recalculate organizer rating when overallRating is not changed', async () => {
      const review = makeReview({ createdAt: new Date() })
      mockReviewRepo.findById.mockResolvedValue(review)
      mockReviewRepo.update.mockResolvedValue({ ...review, comment: 'Updated comment' })

      await service.updateReview('user_1', 'review_1', { comment: 'Updated comment' })

      expect(mockOrganizerProfileRepo.update).not.toHaveBeenCalled()
    })
  })

  // ─── addOrganizerReply ───────────────────────────────

  describe('addOrganizerReply', () => {
    it('should add organizer reply to a review', async () => {
      mockReviewRepo.findById.mockResolvedValue(makeReview({ organizerReply: null }))
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org_1' })
      mockReviewRepo.updateOrganizerReply.mockResolvedValue(
        makeReview({ organizerReply: 'Thank you!' }),
      )

      const result = await service.addOrganizerReply('organizer_user', 'review_1', 'Thank you!')

      expect(result.organizerReply).toBe('Thank you!')
      expect(mockReviewRepo.updateOrganizerReply).toHaveBeenCalledWith('review_1', 'Thank you!')
    })

    it('should throw NotFoundError when review does not exist', async () => {
      mockReviewRepo.findById.mockResolvedValue(null)

      await expect(service.addOrganizerReply('org_user', 'review_1', 'Thanks'))
        .rejects.toThrow(NotFoundError)
    })

    it('should throw ForbiddenError when user is not the trip organizer', async () => {
      mockReviewRepo.findById.mockResolvedValue(makeReview())
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'different_org' })

      await expect(service.addOrganizerReply('org_user', 'review_1', 'Thanks'))
        .rejects.toThrow(ForbiddenError)
    })

    it('should throw ForbiddenError when user has no organizer profile', async () => {
      mockReviewRepo.findById.mockResolvedValue(makeReview())
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(service.addOrganizerReply('org_user', 'review_1', 'Thanks'))
        .rejects.toThrow(ForbiddenError)
    })

    it('should throw ConflictError when organizer already replied', async () => {
      mockReviewRepo.findById.mockResolvedValue(makeReview({ organizerReply: 'Already replied' }))
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org_1' })

      await expect(service.addOrganizerReply('org_user', 'review_1', 'Thanks again'))
        .rejects.toThrow(ConflictError)
    })
  })

  // ─── getReviewsForTrip ──────────────────────────────

  describe('getReviewsForTrip', () => {
    it('should return paginated reviews with rating summary', async () => {
      mockReviewRepo.findByTripId.mockResolvedValue({
        data: [makeReview()],
        total: 1,
      })
      mockReviewRepo.getRatingDistribution.mockResolvedValue([
        { overallRating: 4, _count: { overallRating: 3 } },
        { overallRating: 5, _count: { overallRating: 2 } },
      ])

      const result = await service.getReviewsForTrip('trip_1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.summary.totalReviews).toBe(5)
      expect(result.summary.averageRating).toBe(4.4)
      expect(result.summary.distribution[4]).toBe(3)
      expect(result.summary.distribution[5]).toBe(2)
      expect(result.summary.distribution[1]).toBe(0)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.totalPages).toBe(1)
    })

    it('should return zero averageRating when no reviews exist', async () => {
      mockReviewRepo.findByTripId.mockResolvedValue({ data: [], total: 0 })
      mockReviewRepo.getRatingDistribution.mockResolvedValue([])

      const result = await service.getReviewsForTrip('trip_1', {})

      expect(result.summary.averageRating).toBe(0)
      expect(result.summary.totalReviews).toBe(0)
    })
  })

  // ─── getMyReviewForBooking ──────────────────────────

  describe('getMyReviewForBooking', () => {
    it('should return the user\'s review for a booking', async () => {
      mockReviewRepo.findByBookingId.mockResolvedValue(makeReview())

      const result = await service.getMyReviewForBooking('user_1', 'booking_1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('review_1')
    })

    it('should return null when no review exists for the booking', async () => {
      mockReviewRepo.findByBookingId.mockResolvedValue(null)

      const result = await service.getMyReviewForBooking('user_1', 'booking_1')

      expect(result).toBeNull()
    })

    it('should return null when review belongs to a different user', async () => {
      mockReviewRepo.findByBookingId.mockResolvedValue(makeReview({ userId: 'other_user' }))

      const result = await service.getMyReviewForBooking('user_1', 'booking_1')

      expect(result).toBeNull()
    })
  })

  // ─── getOrganizerDashboardReviews ────────────────────

  describe('getOrganizerDashboardReviews', () => {
    const mockOrganizer = { id: 'org_1', userId: 'user_1' }
    const mockReviews = [makeReview(), makeReview({ id: 'review_2', overallRating: 3 })]

    it('should return paginated reviews for the organizer with default filters', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockReviewRepo.findByOrganizerIdWithFilters.mockResolvedValue({
        data: mockReviews,
        total: 2,
      })

      const result = await service.getOrganizerDashboardReviews('user_1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      expect(mockReviewRepo.findByOrganizerIdWithFilters).toHaveBeenCalledWith(
        'org_1',
        expect.objectContaining({ page: 1, limit: 10 }),
        expect.objectContaining({ skip: 0, take: 10 }),
      )
    })

    it('should pass tripId and rating filters to the repository', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockReviewRepo.findByOrganizerIdWithFilters.mockResolvedValue({ data: [mockReviews[0]], total: 1 })

      await service.getOrganizerDashboardReviews('user_1', {
        tripId: 'trip_1',
        rating: 5,
        sort: 'rating_high',
        page: 1,
        limit: 10,
      })

      expect(mockReviewRepo.findByOrganizerIdWithFilters).toHaveBeenCalledWith(
        'org_1',
        expect.objectContaining({ tripId: 'trip_1', rating: 5, sort: 'rating_high' }),
        expect.any(Object),
      )
    })

    it('should throw ForbiddenError when user has no OrganizerProfile', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.getOrganizerDashboardReviews('user_1', {}),
      ).rejects.toThrow(ForbiddenError)
    })

    it('should return empty data and correct pagination when no reviews exist', async () => {
      mockOrganizerProfileRepo.findByUserId.mockResolvedValue(mockOrganizer)
      mockReviewRepo.findByOrganizerIdWithFilters.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getOrganizerDashboardReviews('user_1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
    })
  })

  // ─── getMyReviews ────────────────────────────────────

  describe('getMyReviews', () => {
    const mockReviews = [makeReview(), makeReview({ id: 'review_2', overallRating: 2 })]

    it('should return paginated reviews written by the user', async () => {
      mockReviewRepo.findAllByUserId.mockResolvedValue({ data: mockReviews, total: 2 })

      const result = await service.getMyReviews('user_1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      expect(mockReviewRepo.findAllByUserId).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({ page: 1, limit: 10 }),
        expect.objectContaining({ skip: 0, take: 10 }),
      )
    })

    it('should return empty list when user has written no reviews', async () => {
      mockReviewRepo.findAllByUserId.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getMyReviews('user_1', {})

      expect(result.data).toHaveLength(0)
      expect(result.pagination.totalPages).toBe(0)
    })

    it('should pass sort filter to the repository', async () => {
      mockReviewRepo.findAllByUserId.mockResolvedValue({ data: mockReviews, total: 2 })

      await service.getMyReviews('user_1', { sort: 'rating_low', page: 1, limit: 10 })

      expect(mockReviewRepo.findAllByUserId).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({ sort: 'rating_low' }),
        expect.any(Object),
      )
    })

    it('should scope results to a specific trip when tripId is provided', async () => {
      const tripReview = makeReview({ tripId: 'trip_abc' })
      mockReviewRepo.findAllByUserId.mockResolvedValue({ data: [tripReview], total: 1 })

      const result = await service.getMyReviews('user_1', { tripId: 'trip_abc', page: 1, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(mockReviewRepo.findAllByUserId).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({ tripId: 'trip_abc' }),
        expect.any(Object),
      )
    })

    it('should return all user reviews when tripId is not provided', async () => {
      mockReviewRepo.findAllByUserId.mockResolvedValue({ data: mockReviews, total: 2 })

      await service.getMyReviews('user_1', { page: 1, limit: 10 })

      expect(mockReviewRepo.findAllByUserId).toHaveBeenCalledWith(
        'user_1',
        expect.not.objectContaining({ tripId: expect.anything() }),
        expect.any(Object),
      )
    })
  })
})

// ═══════════════════════════════════════════════════════
// Redis Cache Invalidation Tests
// ═══════════════════════════════════════════════════════

describe('ReviewService — Redis Cache Invalidation', () => {
  const mockCacheService = {
    getOrSet: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    invalidateByPrefix: vi.fn(),
  }

  let cachedService: ReviewService

  const dto = {
    tripId: 'trip_1',
    bookingId: 'booking_1',
    overallRating: 5,
    comment: 'Amazing!',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    cachedService = new ReviewService(
      mockReviewRepo as any,
      mockOrganizerProfileRepo as any,
      logger as any,
      mockCacheService as any,
    )
    mockCacheService.del.mockResolvedValue(undefined)
    mockCacheService.invalidateByPrefix.mockResolvedValue(0)
  })

  describe('createReview — cache invalidation', () => {
    it('should invalidate trip detail + organizer cache after review creation', async () => {
      mockReviewRepo.findBookingForReview.mockResolvedValue(
        makeBookingForReview({
          trip: { organizerId: 'org_1', slug: 'goa-trip', organizer: { slug: 'desi-explorers' } },
        }),
      )
      mockReviewRepo.findByBookingId.mockResolvedValue(null)
      mockReviewRepo.create.mockResolvedValue(makeReview({ overallRating: 5 }))
      mockReviewRepo.getOrganizerRatingStats.mockResolvedValue({
        _avg: { overallRating: 4.5 },
        _count: { overallRating: 3 },
      })
      mockOrganizerProfileRepo.update.mockResolvedValue({})

      await cachedService.createReview('user_1', dto)

      expect(mockCacheService.del).toHaveBeenCalledWith('cache:trips:detail:goa-trip')
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('cache:organizers:slug:desi-explorers')
    })

    it('should not call cache when cache is null', async () => {
      const noCacheService = new ReviewService(
        mockReviewRepo as any,
        mockOrganizerProfileRepo as any,
        logger as any,
      )
      mockReviewRepo.findBookingForReview.mockResolvedValue(
        makeBookingForReview({
          trip: { organizerId: 'org_1', slug: 'goa-trip', organizer: { slug: 'desi-explorers' } },
        }),
      )
      mockReviewRepo.findByBookingId.mockResolvedValue(null)
      mockReviewRepo.create.mockResolvedValue(makeReview({ overallRating: 5 }))
      mockReviewRepo.getOrganizerRatingStats.mockResolvedValue({
        _avg: { overallRating: 4.5 },
        _count: { overallRating: 3 },
      })
      mockOrganizerProfileRepo.update.mockResolvedValue({})

      await noCacheService.createReview('user_1', dto)

      expect(mockCacheService.del).not.toHaveBeenCalled()
      expect(mockCacheService.invalidateByPrefix).not.toHaveBeenCalled()
    })

    it('should skip organizer cache invalidation when organizer slug is missing', async () => {
      mockReviewRepo.findBookingForReview.mockResolvedValue(
        makeBookingForReview({
          trip: { organizerId: 'org_1', slug: 'goa-trip', organizer: null },
        }),
      )
      mockReviewRepo.findByBookingId.mockResolvedValue(null)
      mockReviewRepo.create.mockResolvedValue(makeReview({ overallRating: 5 }))
      mockReviewRepo.getOrganizerRatingStats.mockResolvedValue({
        _avg: { overallRating: 4.5 },
        _count: { overallRating: 3 },
      })
      mockOrganizerProfileRepo.update.mockResolvedValue({})

      await cachedService.createReview('user_1', dto)

      expect(mockCacheService.del).toHaveBeenCalledWith('cache:trips:detail:goa-trip')
      expect(mockCacheService.invalidateByPrefix).not.toHaveBeenCalled()
    })
  })
})
