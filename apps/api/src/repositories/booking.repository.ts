import { Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { TripBookingFilters } from '@shared/types/booking.types'

const BOOKING_INCLUDE_LIST = {
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  travelerDetails: {
    where: { isDeleted: false },
    select: {
      id: true,
      name: true,
      phone: true,
      age: true,
      gender: true,
      isPrimary: true,
    },
  },
} as const

export class BookingRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Finds paginated bookings for a specific trip with optional filters.
   *
   * WHERE: tripId, isDeleted=false, optional bookingStatus, optional user name search
   * Include: user (name, email, avatarUrl), travelerDetails
   * Used by: TripService.getTripBookings()
   *
   * Edge cases:
   * - Returns { data: [], total: 0 } when no bookings match
   * - Search is case-insensitive partial match on user.name
   */
  async findByTripId(
    tripId: string,
    filters: TripBookingFilters,
    pagination: { offset: number; limit: number },
  ) {
    const where = this.buildWhere(tripId, filters)
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: this.buildOrderBy(filters.sort),
        include: BOOKING_INCLUDE_LIST,
      }),
      this.prisma.booking.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Aggregates booking summary stats for a trip.
   *
   * - confirmedCount: bookings with status CONFIRMED or COMPLETED
   * - totalTravelers: sum of numTravelers across CONFIRMED/COMPLETED bookings
   * - revenue: net revenue = CAPTURED PAYMENTs − CAPTURED REFUNDs
   * Used by: TripService.getTripBookingSummary()
   *
   * Edge cases:
   * - Returns 0 for all counts when no bookings exist
   * - Revenue nets out payments and refunds (fully refunded booking = ₹0)
   * - INITIATED/FAILED transactions are excluded
   */
  async getTripBookingSummary(tripId: string) {
    const [confirmedAgg, paymentAgg, refundAgg, pendingRequests] = await this.prisma.$transaction([
      this.prisma.booking.aggregate({
        _count: { id: true },
        _sum: { numTravelers: true },
        where: {
          tripId,
          bookingStatus: { in: ['CONFIRMED', 'COMPLETED'] },
          isDeleted: false,
        },
      }),
      this.prisma.paymentTransaction.aggregate({
        _sum: { amount: true },
        where: {
          status: 'CAPTURED',
          type: 'PAYMENT',
          booking: { tripId, isDeleted: false },
        },
      }),
      this.prisma.paymentTransaction.aggregate({
        _sum: { amount: true },
        where: {
          status: 'CAPTURED',
          type: 'REFUND',
          booking: { tripId, isDeleted: false },
        },
      }),
      this.prisma.tripRequest.count({
        where: {
          tripId,
          status: 'PENDING',
          isDeleted: false,
        },
      }),
    ])

    const payments = paymentAgg._sum.amount ?? 0
    const refunds = refundAgg._sum.amount ?? 0

    return {
      confirmedCount: confirmedAgg._count.id,
      totalTravelers: confirmedAgg._sum.numTravelers ?? 0,
      revenue: payments - refunds,
      pendingRequestsCount: pendingRequests,
    }
  }

  // Builds dynamic WHERE clause for bookingStatus + user name search
  private buildWhere(
    tripId: string,
    filters: TripBookingFilters,
  ): Prisma.BookingWhereInput {
    return {
      tripId,
      isDeleted: false,
      ...(filters.bookingStatus && {
        bookingStatus: filters.bookingStatus as Prisma.EnumBookingStatusFilter,
      }),
      ...(filters.search && {
        user: {
          name: { contains: filters.search, mode: 'insensitive' as const },
        },
      }),
    }
  }

  // Maps sort filter to Prisma orderBy
  private buildOrderBy(sort?: string): Prisma.BookingOrderByWithRelationInput {
    switch (sort) {
      case 'oldest':
        return { createdAt: 'asc' }
      case 'amount_desc':
        return { totalAmount: 'desc' }
      case 'amount_asc':
        return { totalAmount: 'asc' }
      case 'newest':
      default:
        return { createdAt: 'desc' }
    }
  }
}
