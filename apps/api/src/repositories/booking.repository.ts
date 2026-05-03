import crypto from 'crypto'
import { Prisma, type BookingStatus, type Gender } from '@prisma/client'
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
  pickupPoint: { select: { id: true, label: true, time: true } },
  dropPoint: { select: { id: true, label: true, time: true } },
} as const

const MY_BOOKING_INCLUDE = {
  trip: {
    select: {
      id: true, title: true, slug: true,
      startDate: true, endDate: true, photos: true,
      tripType: true, cancellationPolicy: true,
      destination: { select: { id: true, name: true, slug: true } },
      organizer: { select: { id: true, businessName: true, rating: true, verificationStatus: true } },
    },
  },
  review: { select: { id: true } },
  pickupPoint: { select: { id: true, label: true, time: true } },
  dropPoint: { select: { id: true, label: true, time: true } },
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

  /**
   * Finds paginated bookings for a specific traveler with tab-based filtering.
   *
   * WHERE: userId (REQUIRED — IDOR prevention AR-2), isDeleted=false
   * Tab mapping:
   *   - 'upcoming' → CONFIRMED/PENDING_PAYMENT + future trip startDate
   *   - 'completed' → COMPLETED
   *   - 'cancelled' → CANCELLED + EXPIRED (AR-1)
   *   - 'all' → no status filter
   *
   * Note (AR-3): upcoming tab joins on trip.startDate — acceptable at MVP scale.
   * Used by: BookingService.getMyBookings()
   */
  async findByUserId(
    userId: string,
    tab: string | undefined,
    pagination: { offset: number; limit: number },
  ) {
    const where = this.buildUserWhere(userId, tab)
    const orderBy = tab === 'upcoming'
      ? { trip: { startDate: 'asc' as const } }
      : { createdAt: 'desc' as const }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where, skip: pagination.offset, take: pagination.limit,
        orderBy, include: MY_BOOKING_INCLUDE,
      }),
      this.prisma.booking.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Returns booking count grouped by status for tab badges.
   * Used by: BookingService.getMyBookingSummary()
   */
  async getMyBookingSummary(userId: string) {
    return this.prisma.booking.groupBy({
      by: ['bookingStatus'],
      _count: { id: true },
      where: { userId, isDeleted: false },
    })
  }

  /**
   * Finds a single booking by ID with trip cancellation details.
   * Used by: BookingService.cancelBooking()
   */
  async findById(id: string) {
    return this.prisma.booking.findFirst({
      where: { id, isDeleted: false },
      include: {
        trip: {
          select: {
            id: true, title: true, startDate: true,
            cancellationPolicy: true, currentBookings: true, version: true,
          },
        },
      },
    })
  }

  /**
   * Cancels a booking — sets status to CANCELLED, stores reason and timestamp.
   * Used by: BookingService.cancelBooking()
   */
  async cancel(id: string, userId: string, reason: string) {
    return this.prisma.booking.update({
      where: { id },
      data: {
        bookingStatus: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledById: userId,
      },
    })
  }

  // ─── Payment Flow Methods ─────────────────────────────────

  /**
   * Creates a booking with nested traveler details in a single transaction.
   *
   * Generates a unique bookingRef (TRP-YYYY-NNNN format).
   * Used by: BookingService.createBooking()
   *
   * Edge case: bookingRef collision is extremely unlikely (cuid-based counter fallback)
   */
  async create(data: {
    tripId: string
    userId: string
    numTravelers: number
    totalAmount: number
    expiresAt: Date
    pickupPointId?: string
    dropPointId?: string
    travelers: Array<{
      name: string
      phone: string
      age: number
      gender: Gender
      isPrimary: boolean
    }>
  }) {
    const bookingRef = await this.generateBookingRef()
    return this.prisma.booking.create({
      data: {
        bookingRef,
        tripId: data.tripId,
        userId: data.userId,
        numTravelers: data.numTravelers,
        totalAmount: data.totalAmount,
        expiresAt: data.expiresAt,
        bookingStatus: 'PENDING_PAYMENT',
        pickupPointId: data.pickupPointId ?? null,
        dropPointId: data.dropPointId ?? null,
        travelerDetails: {
          create: data.travelers,
        },
      },
      include: { travelerDetails: true },
    })
  }

  /**
   * Updates booking status with optional extra fields.
   *
   * Used by: BookingService.confirmBooking(), cron expiry, webhook handlers
   */
  async updateStatus(
    id: string,
    bookingStatus: BookingStatus,
    extras?: Record<string, unknown>,
  ) {
    return this.prisma.booking.update({
      where: { id },
      data: { bookingStatus, ...extras },
    })
  }

  /**
   * Finds an active (PENDING_PAYMENT or CONFIRMED) booking for user+trip.
   *
   * Used by: BookingService.createBooking() — duplicate/idempotency check
   * If PENDING_PAYMENT exists → return same order (idempotent)
   * If CONFIRMED exists → ConflictError
   */
  async findActiveByUserAndTrip(userId: string, tripId: string) {
    return this.prisma.booking.findFirst({
      where: {
        userId,
        tripId,
        bookingStatus: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
        isDeleted: false,
      },
      include: {
        paymentTransactions: {
          where: { type: 'PAYMENT' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
  }

  /**
   * Finds PENDING_PAYMENT bookings where expiresAt has passed.
   *
   * Used by: Cron job — expire stale bookings
   * Includes paymentTransactions for Razorpay order status check before expiring
   */
  async findExpiredPendingBookings() {
    return this.prisma.booking.findMany({
      where: {
        bookingStatus: 'PENDING_PAYMENT',
        expiresAt: { lt: new Date() },
        isDeleted: false,
      },
      include: {
        paymentTransactions: {
          where: { type: 'PAYMENT' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
  }

  /**
   * Finds a booking with full payment details — trip, organizer, and payment transactions.
   *
   * Used by: BookingService.confirmBooking() — needs trip.version, organizer.razorpayAccountId
   */
  async findWithPaymentDetails(id: string) {
    return this.prisma.booking.findFirst({
      where: { id, isDeleted: false },
      include: {
        trip: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            maxGroupSize: true,
            currentBookings: true,
            version: true,
            cancellationPolicy: true,
            pricePerPerson: true,
            earlyBirdPrice: true,
            earlyBirdDeadline: true,
            bookingMode: true,
            acceptingBookings: true,
            status: true,
            bookingDeadline: true,
            organizer: {
              select: {
                id: true,
                razorpayAccountId: true,
                commissionRate: true,
                businessName: true,
              },
            },
          },
        },
        paymentTransactions: {
          where: { type: 'PAYMENT' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
  }

  /**
   * Generates a unique booking reference: TRP-YYYY-XXXXXX.
   * Retries up to 3 times on collision (UNIQUE constraint on bookingRef).
   */
  private async generateBookingRef(): Promise<string> {
    const year = new Date().getFullYear()
    const maxRetries = 3
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.prisma.booking.count()
      const seq = String(count + 1).padStart(4, '0')
      const suffix = crypto.randomBytes(2).toString('hex').toUpperCase()
      const ref = `TRP-${year}-${seq}${suffix}`
      const existing = await this.prisma.booking.findFirst({ where: { bookingRef: ref } })
      if (!existing) return ref
    }
    // Fallback: use timestamp + random to guarantee uniqueness
    return `TRP-${year}-${Date.now().toString(36).toUpperCase()}`
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
        bookingStatus: Array.isArray(filters.bookingStatus)
          ? { in: filters.bookingStatus }
          : filters.bookingStatus as Prisma.EnumBookingStatusFilter,
      }),
      ...(filters.search && {
        user: {
          name: { contains: filters.search, mode: 'insensitive' as const },
        },
      }),
    }
  }

  // Builds WHERE clause for traveler's booking list — userId always required (IDOR)
  private buildUserWhere(userId: string, tab?: string): Prisma.BookingWhereInput {
    const base: Prisma.BookingWhereInput = { userId, isDeleted: false }
    switch (tab) {
      case 'upcoming':
        return {
          ...base,
          bookingStatus: { in: ['CONFIRMED', 'PENDING_PAYMENT'] },
          trip: { startDate: { gt: new Date() } },
        }
      case 'completed':
        return { ...base, bookingStatus: 'COMPLETED' }
      case 'cancelled':
        return { ...base, bookingStatus: { in: ['CANCELLED', 'EXPIRED'] } }
      case 'all':
      default:
        return base
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
