import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient, TransactionClient } from '../lib/prisma'
import type { TripFilters } from '@shared/types/trip.types'
import { TRIP_STATUS } from '@shared/constants/trip-types'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'

export const TRIP_INCLUDE_SUMMARY = {
  destination: {
    select: { id: true, name: true, slug: true },
  },
  organizer: {
    select: {
      id: true,
      slug: true,
      businessName: true,
      rating: true,
      totalReviews: true,
      verificationStatus: true,
    },
  },
  _count: {
    select: { reviews: { where: { isDeleted: false } } },
  },
} as const

const TRIP_INCLUDE_DETAIL = {
  ...TRIP_INCLUDE_SUMMARY,
  reviews: {
    where: { isDeleted: false },
    select: {
      id: true,
      overallRating: true,
      comment: true,
      photos: true,
      editedAt: true,
      organizerReply: true,
      organizerReplyAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' as const },
    take: 10,
  },
  transferPoints: {
    where: { isDeleted: false },
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true, type: true, label: true, address: true,
      time: true, extraCharge: true, sortOrder: true,
    },
  },
} as const

export class TripRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  async withTransaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn)
  }

  async search(filters: TripFilters, pagination: { offset: number; limit: number }) {
    const where = this.buildWhere(filters)
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: this.buildOrderBy(filters.sort),
        include: TRIP_INCLUDE_SUMMARY,
      }),
      this.prisma.trip.count({ where }),
    ])
    return { data, total }
  }

  async findById(id: string) {
    return this.prisma.trip.findFirst({
      where: { id, isDeleted: false },
      include: TRIP_INCLUDE_DETAIL,
    })
  }

  async findBySlug(slug: string) {
    return this.prisma.trip.findFirst({
      where: { slug, isDeleted: false },
      include: TRIP_INCLUDE_DETAIL,
    })
  }

  async findByOrganizerId(organizerId: string, status?: string) {
    return this.prisma.trip.findMany({
      where: {
        organizerId,
        isDeleted: false,
        ...(status && { status: status as Prisma.EnumTripStatusFilter }),
      },
      include: TRIP_INCLUDE_SUMMARY,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByOrganizerIdPaginated(
    organizerId: string,
    status: string | undefined,
    pagination: { offset: number; limit: number },
  ) {
    const where: Prisma.TripWhereInput = {
      organizerId,
      isDeleted: false,
      ...(status && { status: status as Prisma.EnumTripStatusFilter }),
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        include: TRIP_INCLUDE_SUMMARY,
        orderBy: { createdAt: 'desc' },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      this.prisma.trip.count({ where }),
    ])
    return { data, total }
  }

  async findByDestinationIdPaginated(
    destinationId: string,
    pagination: { offset: number; limit: number },
  ) {
    const where: Prisma.TripWhereInput = {
      destinationId,
      isDeleted: false,
      status: { in: ['ACTIVE', 'FULL'] },
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        include: TRIP_INCLUDE_SUMMARY,
        orderBy: { startDate: 'asc' },
        skip: pagination.offset,
        take: pagination.limit,
      }),
      this.prisma.trip.count({ where }),
    ])
    return { data, total }
  }

  async getDestinationStats(destinationId: string) {
    const baseWhere: Prisma.TripWhereInput = {
      destinationId,
      isDeleted: false,
      status: { in: ['ACTIVE', 'FULL'] },
    }

    const [priceAgg, organizerIds, upcomingCount] = await Promise.all([
      this.prisma.trip.aggregate({
        where: baseWhere,
        _avg: { pricePerPerson: true },
      }),
      this.prisma.trip.findMany({
        where: baseWhere,
        select: { organizerId: true },
        distinct: ['organizerId'],
      }),
      this.prisma.trip.count({
        where: { ...baseWhere, startDate: { gt: new Date() } },
      }),
    ])

    return {
      avgPrice: Math.round(priceAgg._avg.pricePerPerson ?? 0),
      organizerCount: organizerIds.length,
      upcomingCount,
    }
  }

  async slugExists(slug: string) {
    const count = await this.prisma.trip.count({ where: { slug } })
    return count > 0
  }

  async create(data: Prisma.TripCreateInput) {
    return this.prisma.trip.create({
      data,
      include: TRIP_INCLUDE_SUMMARY,
    })
  }

  async update(id: string, data: Prisma.TripUpdateInput) {
    return this.prisma.trip.update({
      where: { id },
      data,
      include: TRIP_INCLUDE_SUMMARY,
    })
  }

  async softDelete(id: string) {
    return this.prisma.trip.update({
      where: { id },
      data: { isDeleted: true, isActive: false, deletedAt: new Date() },
    })
  }

  async findSlugsForSitemap(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.trip.findMany({
      where: { isDeleted: false, status: { in: ['ACTIVE', 'FULL'] } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  private buildWhere(filters: TripFilters): Prisma.TripWhereInput {
    return {
      isDeleted: false,
      status: 'ACTIVE',
      ...(filters.destinationId && { destinationId: filters.destinationId }),
      ...(filters.destination && {
        destination: { name: { contains: filters.destination, mode: 'insensitive' as const } },
      }),
      ...(filters.bookingMode && { bookingMode: filters.bookingMode as Prisma.EnumBookingModeFilter }),
      ...(filters.tripType && { tripType: filters.tripType as Prisma.EnumTripTypeFilter }),
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            pricePerPerson: {
              ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
              ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
            },
          }
        : {}),
      ...(filters.startDate && { startDate: { gte: new Date(filters.startDate) } }),
    }
  }

  /**
   * Calculates net revenue for an organizer across all their trips.
   *
   * Revenue = SUM(CAPTURED PAYMENT transactions) - SUM(CAPTURED REFUND transactions)
   *
   * Only considers:
   * - PaymentTransaction with status=CAPTURED (successful payments)
   * - type=PAYMENT adds to revenue, type=REFUND subtracts
   * - Linked to bookings on non-deleted trips owned by this organizer
   *
   * Edge cases:
   * - Returns 0 if no payments exist
   * - INITIATED/FAILED payments are excluded (not yet captured)
   * - ESCROW_RELEASE is excluded (platform payout, not revenue)
   * - Cancelled bookings with refunds correctly reduce revenue
   */
  async calculateOrganizerRevenue(organizerId: string): Promise<number> {
    const groups = await this.prisma.paymentTransaction.groupBy({
      by: ['type'],
      _sum: { amount: true },
      where: {
        status: 'CAPTURED',
        type: { in: ['PAYMENT', 'REFUND'] },
        booking: {
          trip: { organizerId, isDeleted: false },
        },
      },
    })
    let payments = 0
    let refunded = 0
    for (const g of groups) {
      if (g.type === 'PAYMENT') payments = g._sum.amount ?? 0
      if (g.type === 'REFUND') refunded = g._sum.amount ?? 0
    }
    return payments - refunded
  }

  /**
   * Counts PENDING trip requests across all of an organizer's active trips.
   * Used for the dashboard "Pending Requests" stat card.
   * Only counts requests on non-deleted trips with status=PENDING.
   */
  async countPendingRequests(organizerId: string): Promise<number> {
    return this.prisma.tripRequest.count({
      where: {
        status: 'PENDING',
        isDeleted: false,
        trip: { organizerId, isDeleted: false },
      },
    })
  }

  /**
   * Lightweight trip fetch for validation-only use cases.
   * No reviews, transfer points, or destination joins — just scalar + organizerId.
   * Used by: TripService.createTripRequest()
   */
  async findByIdLite(id: string) {
    return this.prisma.trip.findUnique({
      where: { id },
      select: {
        id: true,
        organizerId: true,
        status: true,
        bookingMode: true,
        acceptingBookings: true,
        maxGroupSize: true,
        currentBookings: true,
        version: true,
        title: true,
        slug: true,
        pricePerPerson: true,
        organizer: { select: { userId: true } },
      },
    })
  }

  /**
   * Fetches trip with organizer payment fields (razorpayAccountId, commissionRate).
   * Only used by BookingService — these fields are NOT exposed in public trip queries.
   */
  async findByIdForBooking(id: string) {
    return this.prisma.trip.findFirst({
      where: { id, isDeleted: false },
      include: {
        ...TRIP_INCLUDE_SUMMARY,
        organizer: {
          select: {
            id: true,
            businessName: true,
            rating: true,
            totalReviews: true,
            verificationStatus: true,
            razorpayAccountId: true,
            commissionRate: true,
          },
        },
        transferPoints: {
          where: { isDeleted: false },
          select: { id: true, type: true, extraCharge: true },
        },
      },
    })
  }

  /**
   * Counts trips for an organizer, optionally filtered by status.
   * Used by: TripService.getOrganizerStats() — lightweight alternative to findByOrganizerId
   */
  async countByOrganizerId(organizerId: string, status?: string): Promise<number> {
    return this.prisma.trip.count({
      where: {
        organizerId,
        isDeleted: false,
        ...(status && { status: status as Prisma.EnumTripStatusFilter }),
      },
    })
  }

  /**
   * Sums currentBookings across all non-deleted trips for an organizer.
   * Used by: TripService.getOrganizerStats() — avoids loading all trip rows
   */
  async sumBookingsByOrganizerId(organizerId: string): Promise<number> {
    const result = await this.prisma.trip.aggregate({
      _sum: { currentBookings: true },
      where: { organizerId, isDeleted: false },
    })
    return result._sum.currentBookings ?? 0
  }

  // ─── Atomic Seat Operations (Optimistic Locking) ──────────

  /**
   * Atomically increments currentBookings using optimistic locking (version column).
   * Returns the number of rows updated: 0 = seats full or version mismatch, 1 = success.
   *
   * Raw SQL because Prisma doesn't support `WHERE currentBookings + N <= maxGroupSize`.
   * Used by: BookingService.confirmBooking()
   */
  async atomicIncrementBookings(tripId: string, count: number, expectedVersion: number): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "Trip"
      SET "currentBookings" = "currentBookings" + ${count},
          "version" = "version" + 1,
          "updatedAt" = NOW()
      WHERE id = ${tripId}
        AND "currentBookings" + ${count} <= "maxGroupSize"
        AND "version" = ${expectedVersion}
        AND "isDeleted" = false
    `
  }

  /**
   * Rollback seat increment if capture fails after seat reservation.
   * No version check — always decrements (recovery operation).
   * Used by: BookingService.confirmBooking() error path
   */
  async atomicDecrementBookings(tripId: string, count: number): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "Trip"
      SET "currentBookings" = GREATEST("currentBookings" - ${count}, 0),
          "version" = "version" + 1,
          "updatedAt" = NOW()
      WHERE id = ${tripId}
        AND "isDeleted" = false
    `
  }

  // ─── Trip Lifecycle Operations ─────────────────────────

  /**
   * Atomically transitions trip ACTIVE → FULL when currentBookings >= maxGroupSize.
   * Single SQL — no TOCTOU race. Returns 1 if transitioned, 0 if not full or already FULL.
   * Does NOT touch acceptingBookings — status alone gates new bookings.
   * Used by: BookingService.confirmBooking()
   */
  async markFullIfAtCapacity(tripId: string): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "Trip"
      SET status = 'FULL',
          "updatedAt" = NOW()
      WHERE id = ${tripId}
        AND "currentBookings" >= "maxGroupSize"
        AND status = 'ACTIVE'
        AND "isDeleted" = false
    `
  }

  /**
   * Atomically transitions trip FULL → ACTIVE when currentBookings < maxGroupSize.
   * Counterpart of markFullIfAtCapacity — triggered after booking cancellation.
   * Does NOT touch acceptingBookings — preserves organizer's manual toggle.
   * Used by: BookingService.cancelBooking()
   */
  async revertFullIfUnderCapacity(tripId: string): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "Trip"
      SET status = 'ACTIVE',
          "updatedAt" = NOW()
      WHERE id = ${tripId}
        AND "currentBookings" < "maxGroupSize"
        AND status = 'FULL'
        AND "isDeleted" = false
    `
  }

  /**
   * Finds ACTIVE/FULL trips past their endDate, ordered oldest-first, with a batch limit.
   * Used by: TripLifecycleService.completeEndedTrips() cron job.
   *
   * Includes organizerId and destinationId for post-completion updates
   * (organizer stats increment, destination tripCount decrement).
   */
  async findTripsToComplete(limit: number) {
    return this.prisma.trip.findMany({
      where: {
        status: { in: ['ACTIVE', 'FULL'] },
        endDate: { lt: new Date() },
        isDeleted: false,
      },
      select: {
        id: true,
        organizerId: true,
        destinationId: true,
        status: true,
      },
      orderBy: { endDate: 'asc' },
      take: limit,
    })
  }

  /** Trips grouped by status. Used by: AdminService.getPlatformStats() */
  async countByStatus(): Promise<Array<{ status: string; count: number }>> {
    const groups = await this.prisma.trip.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { isDeleted: false },
    })
    return groups.map((g) => ({ status: g.status, count: g._count.id }))
  }

  /** Trips grouped by tripType. Used by: AdminService.getPlatformStats() */
  async countByType(): Promise<Array<{ type: string; count: number }>> {
    const groups = await this.prisma.trip.groupBy({
      by: ['tripType'],
      _count: { id: true },
      where: { isDeleted: false, status: { in: [TRIP_STATUS.ACTIVE, TRIP_STATUS.FULL, TRIP_STATUS.COMPLETED] } },
    })
    return groups.map((g) => ({ type: g.tripType, count: g._count.id }))
  }

  /**
   * Paginated COMPLETED trips with booking count and cashback stats.
   * Supports search on trip title.
   * Used by: AdminService.getCompletedTripsForCashback()
   */
  async findCompletedTripsForCashback(
    filters: { search?: string },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.TripWhereInput = {
      status: TRIP_STATUS.COMPLETED,
      isDeleted: false,
      ...(filters.search && {
        title: { contains: filters.search, mode: 'insensitive' as const },
      }),
    }

    const [trips, total] = await this.prisma.$transaction([
      this.prisma.trip.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { endDate: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          startDate: true,
          endDate: true,
          currentBookings: true,
        },
      }),
      this.prisma.trip.count({ where }),
    ])

    // Batch-fetch cashback stats for all trips in one query
    const tripIds = trips.map((t) => t.id)
    const cashbackStats = tripIds.length
      ? await this.prisma.walletTransaction.groupBy({
          by: ['referenceId'],
          where: {
            type: WALLET_TX.CASHBACK,
            referenceModel: WALLET_REFERENCE_MODELS.BOOKING,
            referenceId: {
              in: await this.prisma.booking
                .findMany({
                  where: { tripId: { in: tripIds }, isDeleted: false },
                  select: { id: true },
                })
                .then((bs) => bs.map((b) => b.id)),
            },
          },
          _count: { id: true },
          _sum: { amount: true },
        })
      : []

    // Group cashback by tripId via booking lookup
    const bookingToTrip = tripIds.length
      ? new Map(
          await this.prisma.booking
            .findMany({
              where: { tripId: { in: tripIds }, isDeleted: false },
              select: { id: true, tripId: true },
            })
            .then((bs) => bs.map((b) => [b.id, b.tripId] as const)),
        )
      : new Map<string, string>()

    const tripCashback = new Map<string, { issuedCount: number; totalAmount: number }>()
    for (const stat of cashbackStats) {
      const tid = bookingToTrip.get(stat.referenceId!)
      if (!tid) continue
      const existing = tripCashback.get(tid) ?? { issuedCount: 0, totalAmount: 0 }
      existing.issuedCount += stat._count.id
      existing.totalAmount += stat._sum.amount ?? 0
      tripCashback.set(tid, existing)
    }

    const data = trips.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      currentBookings: t.currentBookings,
      cashbackStats: tripCashback.get(t.id) ?? { issuedCount: 0, totalAmount: 0 },
    }))

    return { data, total }
  }

  private buildOrderBy(sort?: string): Prisma.TripOrderByWithRelationInput {
    switch (sort) {
      case 'price_asc':
        return { pricePerPerson: 'asc' }
      case 'price_desc':
        return { pricePerPerson: 'desc' }
      case 'rating':
        return { organizer: { rating: 'desc' } }
      case 'popularity':
        return { currentBookings: 'desc' }
      case 'date':
      default:
        return { startDate: 'asc' }
    }
  }
}
