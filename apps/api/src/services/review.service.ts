import { Logger } from 'pino'
import type { CreateReviewDto, UpdateReviewDto, ReviewListFilters, ReviewSummary, OrganizerReviewFilters } from '@shared/types/review.types'
import { ReviewRepository } from '../repositories/review.repository'
import { OrganizerProfileRepository } from '../repositories/organizer-profile.repository'
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../errors/app-error'
import type { CacheService } from './cache.service'
import { REVIEW_EDIT_WINDOW_DAYS } from '@shared/constants/review'
import { BOOKING_STATUS } from '@shared/constants'
import { PAGINATION_DEFAULTS, paginate } from '../utils/constants'
import { cacheInvalidation } from '../utils/cache-keys'

export class ReviewService {
  constructor(
    private reviewRepo: ReviewRepository,
    private organizerProfileRepo: OrganizerProfileRepository,
    private logger: Logger,
    private cache: CacheService | null = null,
  ) {}

  /**
   * Creates a new review for a completed booking.
   *
   * Guards:
   * - Booking must exist and belong to the user
   * - Booking must be COMPLETED
   * - No existing review for this booking (one per booking)
   *
   * Side effects:
   * - Recalculates OrganizerProfile.rating + totalReviews cache
   *
   * @throws NotFoundError — booking not found
   * @throws ForbiddenError — booking doesn't belong to user
   * @throws ValidationError — booking not COMPLETED
   * @throws ConflictError — review already exists for this booking
   */
  async createReview(userId: string, dto: CreateReviewDto) {
    const booking = await this.reviewRepo.findBookingForReview(dto.bookingId)
    if (!booking) throw new NotFoundError('Booking')
    if (booking.userId !== userId) throw new ForbiddenError('You can only review your own bookings')
    if (booking.bookingStatus !== BOOKING_STATUS.COMPLETED) {
      throw new ValidationError('You can only review completed trips')
    }

    const existing = await this.reviewRepo.findByBookingId(dto.bookingId)
    if (existing) throw new ConflictError('You have already reviewed this booking')

    const review = await this.reviewRepo.create({
      tripId: dto.tripId,
      bookingId: dto.bookingId,
      userId,
      overallRating: dto.overallRating,
      organizationRating: dto.organizationRating,
      valueRating: dto.valueRating,
      safetyRating: dto.safetyRating,
      accuracyRating: dto.accuracyRating,
      comment: dto.comment,
      photos: dto.photos ?? [],
    })

    // Recalculate organizer rating cache
    await this.recalculateOrganizerRating(booking.trip.organizerId)

    this.logger.info({ reviewId: review.id, bookingId: dto.bookingId, userId }, 'Review created')

    // Invalidate trip detail cache (rating changed) + organizer profile cache
    if (this.cache) {
      await this.cache.del(`cache:trips:detail:${booking.trip.slug}`)
      if (booking.trip.organizer?.slug) {
        await this.cache.invalidateByPrefix(cacheInvalidation.organizerProfile(booking.trip.organizer.slug))
      }
    }

    return review
  }

  /**
   * Updates an existing review within the edit window (30 days).
   *
   * Guards:
   * - Review must exist and belong to the user
   * - Review must be within edit window
   *
   * Side effects:
   * - Sets editedAt timestamp
   * - Recalculates OrganizerProfile.rating if overallRating changed
   *
   * @throws NotFoundError — review not found
   * @throws ForbiddenError — review doesn't belong to user
   * @throws ValidationError — edit window expired
   */
  async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.reviewRepo.findById(reviewId)
    if (!review) throw new NotFoundError('Review')
    if (review.userId !== userId) throw new ForbiddenError('You can only edit your own reviews')

    const daysSinceCreation = (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCreation > REVIEW_EDIT_WINDOW_DAYS) {
      throw new ValidationError(`Reviews can only be edited within ${REVIEW_EDIT_WINDOW_DAYS} days of creation`)
    }

    const updated = await this.reviewRepo.update(reviewId, {
      ...(dto.overallRating !== undefined && { overallRating: dto.overallRating }),
      ...(dto.organizationRating !== undefined && { organizationRating: dto.organizationRating }),
      ...(dto.valueRating !== undefined && { valueRating: dto.valueRating }),
      ...(dto.safetyRating !== undefined && { safetyRating: dto.safetyRating }),
      ...(dto.accuracyRating !== undefined && { accuracyRating: dto.accuracyRating }),
      ...(dto.comment !== undefined && { comment: dto.comment }),
      ...(dto.photos !== undefined && { photos: dto.photos }),
    })

    // Recalculate organizer rating if overall rating changed
    if (dto.overallRating !== undefined) {
      await this.recalculateOrganizerRating(review.trip!.organizerId)
    }

    this.logger.info({ reviewId, userId }, 'Review updated')
    return updated
  }

  /**
   * Adds an organizer reply to a review.
   * Only the organizer who owns the trip can reply, and only once per review.
   *
   * @throws NotFoundError — review not found
   * @throws ForbiddenError — user is not the trip organizer
   * @throws ConflictError — organizer already replied
   */
  async addOrganizerReply(userId: string, reviewId: string, reply: string) {
    const review = await this.reviewRepo.findById(reviewId)
    if (!review) throw new NotFoundError('Review')

    // Verify the user is the organizer of the trip
    const organizerProfile = await this.organizerProfileRepo.findByUserId(userId)
    if (!organizerProfile || review.trip!.organizerId !== organizerProfile.id) {
      throw new ForbiddenError('Only the trip organizer can reply to reviews')
    }

    if (review.organizerReply) {
      throw new ConflictError('You have already replied to this review')
    }

    const updated = await this.reviewRepo.updateOrganizerReply(reviewId, reply)

    this.logger.info({ reviewId, organizerId: organizerProfile.id }, 'Organizer replied to review')
    return updated
  }

  /**
   * Returns paginated reviews for a trip with rating summary.
   * Public endpoint — no auth required.
   */
  async getReviewsForTrip(tripId: string, filters: ReviewListFilters) {
    const page = filters.page ?? PAGINATION_DEFAULTS.page
    const limit = Math.min(filters.limit ?? 10, PAGINATION_DEFAULTS.maxLimit)
    const offset = (page - 1) * limit

    const [reviewResult, distribution] = await Promise.all([
      this.reviewRepo.findByTripId(tripId, filters, { offset, limit }),
      this.reviewRepo.getRatingDistribution(tripId),
    ])

    // Build summary
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let totalRating = 0
    let totalCount = 0
    for (const entry of distribution) {
      dist[entry.overallRating] = entry._count.overallRating
      totalRating += entry.overallRating * entry._count.overallRating
      totalCount += entry._count.overallRating
    }

    const summary: ReviewSummary = {
      averageRating: totalCount > 0 ? Math.round((totalRating / totalCount) * 10) / 10 : 0,
      totalReviews: totalCount,
      distribution: dist as ReviewSummary['distribution'],
    }

    return {
      data: reviewResult.data,
      summary,
      pagination: {
        page,
        limit,
        total: reviewResult.total,
        totalPages: Math.ceil(reviewResult.total / limit),
      },
    }
  }

  /**
   * Fetches the user's review for a specific booking.
   * Returns null if no review exists.
   */
  async getMyReviewForBooking(userId: string, bookingId: string) {
    const review = await this.reviewRepo.findByBookingId(bookingId)
    if (review && review.userId !== userId) return null
    return review
  }

  /**
   * Paginated list of reviews across all of the organizer's trips.
   * Resolves the OrganizerProfile from userId first.
   *
   * Business rules:
   * - User must have an OrganizerProfile
   * - Optional tripId scopes to a single trip (must belong to this organizer)
   * - Optional rating filters by exact overallRating value
   *
   * @throws ForbiddenError — user has no OrganizerProfile
   */
  async getOrganizerDashboardReviews(userId: string, filters: OrganizerReviewFilters) {
    const organizer = await this.organizerProfileRepo.findByUserId(userId)
    if (!organizer) throw new ForbiddenError('Organizer profile not found')

    const pg = paginate(filters)
    const { data, total } = await this.reviewRepo.findByOrganizerIdWithFilters(
      organizer.id,
      filters,
      { skip: pg.skip, take: pg.take },
    )
    return { data, pagination: pg.meta(total) }
  }

  /**
   * Paginated list of all reviews written by the traveler.
   * No ownership guards — users can always view their own reviews.
   */
  async getMyReviews(userId: string, filters: ReviewListFilters) {
    const pg = paginate(filters)
    const { data, total } = await this.reviewRepo.findAllByUserId(
      userId,
      filters,
      { skip: pg.skip, take: pg.take },
    )
    return { data, pagination: pg.meta(total) }
  }

  /**
   * Recalculates and updates the OrganizerProfile.rating + totalReviews
   * materialized cache from all reviews of the organizer's trips.
   */
  private async recalculateOrganizerRating(organizerId: string) {
    const stats = await this.reviewRepo.getOrganizerRatingStats(organizerId)
    const avgRating = stats._avg.overallRating ?? 0
    const totalReviews = stats._count.overallRating ?? 0

    await this.organizerProfileRepo.update(organizerId, {
      rating: Math.round(avgRating * 10) / 10,
      totalReviews,
    })
  }
}
