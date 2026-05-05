import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { ReviewListFilters } from '@shared/types/review.types'

const REVIEW_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
} as const

const REVIEW_SELECT = {
  id: true,
  tripId: true,
  bookingId: true,
  userId: true,
  overallRating: true,
  organizationRating: true,
  valueRating: true,
  safetyRating: true,
  accuracyRating: true,
  comment: true,
  photos: true,
  editedAt: true,
  organizerReply: true,
  organizerReplyAt: true,
  createdAt: true,
  user: { select: REVIEW_USER_SELECT },
} as const

export class ReviewRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Finds a booking with the fields needed for review creation/validation.
   * Includes trip.organizerId for organizer rating recalculation.
   * Used by: ReviewService.createReview()
   */
  async findBookingForReview(bookingId: string) {
    return this.prisma.booking.findFirst({
      where: { id: bookingId, isDeleted: false },
      select: {
        id: true,
        userId: true,
        bookingStatus: true,
        tripId: true,
        trip: {
          select: { organizerId: true },
        },
      },
    })
  }

  /**
   * Creates a new review record.
   * Used by: ReviewService.createReview()
   */
  async create(data: Prisma.ReviewUncheckedCreateInput) {
    return this.prisma.review.create({
      data,
      select: REVIEW_SELECT,
    })
  }

  /**
   * Finds a review by its ID with user info.
   * Used by: ReviewService.updateReview(), ReviewService.addOrganizerReply()
   */
  async findById(id: string) {
    return this.prisma.review.findFirst({
      where: { id },
      select: {
        ...REVIEW_SELECT,
        trip: {
          select: { organizerId: true },
        },
      },
    })
  }

  /**
   * Finds a review for a specific booking.
   * One review per booking constraint is enforced by DB unique index.
   * Used by: ReviewService.createReview() guard, ReviewService.getMyReviewForBooking()
   */
  async findByBookingId(bookingId: string) {
    return this.prisma.review.findFirst({
      where: { bookingId },
      select: REVIEW_SELECT,
    })
  }

  /**
   * Paginated reviews for a trip, ordered by sort filter.
   * Includes user info for display.
   * Used by: ReviewService.getReviewsForTrip()
   */
  async findByTripId(
    tripId: string,
    filters: ReviewListFilters,
    pagination: { offset: number; limit: number },
  ) {
    const where: Prisma.ReviewWhereInput = { tripId }
    const orderBy = this.buildOrderBy(filters.sort)

    const [data, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: REVIEW_SELECT,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy,
      }),
      this.prisma.review.count({ where }),
    ])

    return { data, total }
  }

  /**
   * Updates review fields and sets editedAt timestamp.
   * Used by: ReviewService.updateReview()
   */
  async update(id: string, data: Prisma.ReviewUpdateInput) {
    return this.prisma.review.update({
      where: { id },
      data: { ...data, editedAt: new Date() },
      select: REVIEW_SELECT,
    })
  }

  /**
   * Sets the organizer reply on a review.
   * Used by: ReviewService.addOrganizerReply()
   */
  async updateOrganizerReply(id: string, reply: string) {
    return this.prisma.review.update({
      where: { id },
      data: {
        organizerReply: reply,
        organizerReplyAt: new Date(),
      },
      select: REVIEW_SELECT,
    })
  }

  /**
   * Calculates the average overallRating for all reviews of a trip's organizer.
   * Used to update the OrganizerProfile.rating materialized cache.
   *
   * Returns { _avg: { overallRating: number | null }, _count: { overallRating: number } }
   */
  async getOrganizerRatingStats(organizerId: string) {
    return this.prisma.review.aggregate({
      where: {
        trip: { organizerId },
        isDeleted: false,
      },
      _avg: { overallRating: true },
      _count: { overallRating: true },
    })
  }

  /**
   * Gets the rating distribution (1-5) for a specific trip.
   * Used by: ReviewService.getReviewsForTrip() for the summary bar.
   */
  async getRatingDistribution(tripId: string) {
    const counts = await this.prisma.review.groupBy({
      by: ['overallRating'],
      where: { tripId, isDeleted: false },
      _count: { overallRating: true },
    })
    return counts
  }

  private buildOrderBy(sort?: string): Prisma.ReviewOrderByWithRelationInput {
    switch (sort) {
      case 'oldest': return { createdAt: 'asc' }
      case 'rating_high': return { overallRating: 'desc' }
      case 'rating_low': return { overallRating: 'asc' }
      default: return { createdAt: 'desc' }
    }
  }
}
