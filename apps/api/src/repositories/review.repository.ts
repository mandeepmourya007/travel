import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { ReviewListFilters, OrganizerReviewFilters } from '@shared/types/review.types'
import type { AdminReviewFilters, AdminReviewSortBy } from '@shared/types/admin.types'
import type { SortOrder } from '@shared/constants/sort'
import { REVIEW_SORT } from '@shared/constants/review'
import { ADMIN_REVIEW_SORT_BY } from '@shared/constants/admin'
import { SORT_ORDER } from '@shared/constants/sort'

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

/** Extends REVIEW_SELECT with trip title/slug for dashboard and traveler list views. */
const REVIEW_WITH_TRIP_SELECT = {
  ...REVIEW_SELECT,
  trip: { select: { title: true, slug: true } },
} as const

/** Admin select — includes organizer businessName for cross-organizer inspection. */
const ADMIN_REVIEW_SELECT = {
  ...REVIEW_SELECT,
  trip: {
    select: {
      id: true,
      title: true,
      slug: true,
      organizer: { select: { businessName: true } },
    },
  },
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
          select: {
            organizerId: true,
            slug: true,
            organizer: { select: { slug: true } },
          },
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
    const where: Prisma.ReviewWhereInput = { tripId, isDeleted: false }
    const orderBy = this.buildOrderBy(filters.sort)

    const [data, total] = await Promise.all([
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
   * Fetches paginated reviews across all trips by a given organizer.
   * Used by: TripService.getOrganizerPublicProfile()
   */
  async findByOrganizerId(organizerId: string, pagination: { offset: number; limit: number }) {
    const where: Prisma.ReviewWhereInput = { trip: { organizerId }, isDeleted: false }
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: {
          ...REVIEW_SELECT,
          trip: { select: { title: true, slug: true } },
        },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ])
    return { data, total }
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

  /**
   * Gets the rating distribution (1-5) across all trips by an organizer.
   * Used by: TripService.getOrganizerPublicProfile() for the summary bar.
   */
  async getRatingDistributionByOrganizer(organizerId: string) {
    const counts = await this.prisma.review.groupBy({
      by: ['overallRating'],
      where: { trip: { organizerId }, isDeleted: false },
      _count: { overallRating: true },
    })
    return counts
  }

  /**
   * Paginated reviews for all trips by an organizer, with optional tripId + rating filters.
   * Extends findByOrganizerId with dashboard-specific scoping.
   * Used by: ReviewService.getOrganizerDashboardReviews()
   *
   * Filters: isDeleted, organizerId (via trip relation), optional tripId, optional overallRating
   */
  async findByOrganizerIdWithFilters(
    organizerId: string,
    filters: Pick<OrganizerReviewFilters, 'tripId' | 'rating' | 'sort'>,
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.ReviewWhereInput = {
      trip: { organizerId },
      isDeleted: false,
      ...(filters.tripId && { tripId: filters.tripId }),
      ...(filters.rating !== undefined && { overallRating: filters.rating }),
    }
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: REVIEW_WITH_TRIP_SELECT,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(filters.sort),
      }),
      this.prisma.review.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Paginated reviews written by a specific user (traveler list view).
   * Used by: ReviewService.getMyReviews()
   *
   * Filters: userId, isDeleted: false
   */
  async findAllByUserId(
    userId: string,
    filters: Pick<ReviewListFilters, 'sort' | 'tripId'>,
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.ReviewWhereInput = {
      userId,
      isDeleted: false,
      ...(filters.tripId && { tripId: filters.tripId }),
    }
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: REVIEW_WITH_TRIP_SELECT,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(filters.sort),
      }),
      this.prisma.review.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Admin view — all platform reviews with cross-organizer filters.
   * Single query joining trip → organizer to avoid N+1.
   * Used by: AdminService.getAdminReviews()
   *
   * Filters: isDeleted, optional overallRating, optional trip title search, optional organizer search
   */
  async findAllAdmin(
    filters: AdminReviewFilters,
    pagination: { skip: number; take: number },
  ) {
    const tripWhere: Prisma.TripWhereInput = {}
    if (filters.tripId) {
      tripWhere.id = filters.tripId
    } else if (filters.tripSearch) {
      tripWhere.title = { contains: filters.tripSearch, mode: 'insensitive' }
    }
    if (filters.organizerSearch) {
      tripWhere.organizer = { businessName: { contains: filters.organizerSearch, mode: 'insensitive' } }
    }

    const where: Prisma.ReviewWhereInput = {
      isDeleted: false,
      ...(filters.rating !== undefined && { overallRating: filters.rating }),
      ...(Object.keys(tripWhere).length > 0 && { trip: tripWhere }),
    }

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: ADMIN_REVIEW_SELECT,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildAdminOrderBy(filters.sortBy, filters.sortOrder),
      }),
      this.prisma.review.count({ where }),
    ])
    return { data, total }
  }

  private buildOrderBy(sort?: string): Prisma.ReviewOrderByWithRelationInput {
    switch (sort) {
      case REVIEW_SORT.OLDEST: return { createdAt: SORT_ORDER.ASC }
      case REVIEW_SORT.RATING_HIGH: return { overallRating: SORT_ORDER.DESC }
      case REVIEW_SORT.RATING_LOW: return { overallRating: SORT_ORDER.ASC }
      default: return { createdAt: SORT_ORDER.DESC }
    }
  }

  private buildAdminOrderBy(
    sortBy?: AdminReviewSortBy,
    sortOrder?: SortOrder,
  ): Prisma.ReviewOrderByWithRelationInput {
    const dir = sortOrder === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC
    switch (sortBy) {
      case ADMIN_REVIEW_SORT_BY.OVERALL_RATING: return { overallRating: dir }
      case ADMIN_REVIEW_SORT_BY.ORGANIZER_NAME: return { trip: { organizer: { businessName: dir } } }
      default: return { createdAt: dir }
    }
  }
}
