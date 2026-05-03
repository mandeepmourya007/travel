import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient, TransactionClient } from '../lib/prisma'
import type { TripFilters } from '@shared/types/trip.types'

export const TRIP_INCLUDE_SUMMARY = {
  destination: {
    select: { id: true, name: true, slug: true },
  },
  organizer: {
    select: {
      id: true,
      businessName: true,
      rating: true,
      totalReviews: true,
      verificationStatus: true,
    },
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
    const result = await this.prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        status: 'CAPTURED',
        type: 'PAYMENT',
        booking: {
          trip: { organizerId, isDeleted: false },
        },
      },
    })
    const refunds = await this.prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        status: 'CAPTURED',
        type: 'REFUND',
        booking: {
          trip: { organizerId, isDeleted: false },
        },
      },
    })
    const payments = result._sum.amount ?? 0
    const refunded = refunds._sum.amount ?? 0
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
