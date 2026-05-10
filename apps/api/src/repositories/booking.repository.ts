import crypto from 'crypto'
import { Prisma, type BookingStatus, type Gender } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { TripBookingFilters } from '@shared/types/booking.types'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'

const ASSIGNED_SEAT_SELECT = {
  select: {
    seatNumber: true,
    seatLabel: true,
    tripVehicle: { select: { label: true } },
  },
} as const

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
      emergencyContactName: true,
      emergencyContactPhone: true,
      assignedSeat: ASSIGNED_SEAT_SELECT,
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
  review: {
    select: {
      id: true, overallRating: true, comment: true,
      photos: true, createdAt: true, editedAt: true,
    },
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
      emergencyContactName: true,
      emergencyContactPhone: true,
      assignedSeat: ASSIGNED_SEAT_SELECT,
    },
  },
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
    const [confirmedAgg, revenueGroups, pendingRequests] = await this.prisma.$transaction([
      this.prisma.booking.aggregate({
        _count: { id: true },
        _sum: { numTravelers: true },
        where: {
          tripId,
          bookingStatus: { in: ['CONFIRMED', 'COMPLETED'] },
          isDeleted: false,
        },
      }),
      this.prisma.paymentTransaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
        where: {
          status: 'CAPTURED',
          type: { in: ['PAYMENT', 'REFUND'] },
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

    let payments = 0
    let refunds = 0
    for (const g of revenueGroups) {
      if (g.type === 'PAYMENT') payments = g._sum.amount ?? 0
      if (g.type === 'REFUND') refunds = g._sum.amount ?? 0
    }

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
            id: true, title: true, slug: true, startDate: true, status: true,
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
    const bookingRef = this.generateBookingRef()
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
            slug: true,
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
        tripRequest: { select: { id: true, status: true } },
        travelerDetails: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' as const } },
      },
    })
  }

  /**
   * Generates a unique booking reference: TRP-YYYY-XXXXXXXX.
   * Uses timestamp + random bytes — zero DB queries.
   * The UNIQUE constraint on bookingRef is the safety net for collisions.
   */
  private generateBookingRef(): string {
    const year = new Date().getFullYear()
    const random = crypto.randomBytes(4).toString('hex').toUpperCase()
    return `TRP-${year}-${random}`
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

  // ─── Admin Panel Methods ─────────────────────────────────

  /** Bookings grouped by status. Used by: AdminService.getPlatformStats() */
  async countByStatusAdmin(): Promise<Array<{ status: string; count: number }>> {
    const groups = await this.prisma.booking.groupBy({
      by: ['bookingStatus'],
      _count: { id: true },
      where: { isDeleted: false },
    })
    return groups.map((g) => ({ status: g.bookingStatus, count: g._count.id }))
  }

  /**
   * Monthly revenue trend for the admin dashboard.
   * Uses raw SQL for DATE_TRUNC grouping (Prisma doesn't support this natively).
   * SAFETY: `months` uses Prisma.raw() (non-parameterizable INTERVAL) — must only
   * receive hardcoded values from the service layer, never user input.
   * Used by: AdminService.getPlatformStats()
   */
  async getRevenueTrend(months: number): Promise<Array<{ month: string; revenue: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{ month: Date; revenue: bigint }>>`
      SELECT m.month,
             COALESCE(SUM(pt."amount"), 0) AS revenue
      FROM generate_series(
             DATE_TRUNC('month', NOW()) - INTERVAL '${Prisma.raw(String(months - 1))} months',
             DATE_TRUNC('month', NOW()),
             '1 month'::interval
           ) AS m(month)
      LEFT JOIN "PaymentTransaction" pt
        ON DATE_TRUNC('month', pt."createdAt") = m.month
        AND pt."type" = 'PAYMENT'
        AND pt."status" = 'CAPTURED'
      GROUP BY m.month
      ORDER BY m.month ASC
    `
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      revenue: Number(r.revenue),
    }))
  }

  /**
   * Paginated list of all bookings for admin view.
   * Includes trip (title, slug, dates) and user (name, email).
   * Supports optional bookingStatus filter and search on bookingRef/user.email.
   * Used by: AdminService.getBookings()
   */
  async findAllAdmin(
    filters: { status?: string; search?: string },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.BookingWhereInput = {
      isDeleted: false,
      ...(filters.status && { bookingStatus: filters.status as BookingStatus }),
      ...(filters.search && {
        OR: [
          { bookingRef: { contains: filters.search, mode: 'insensitive' as const } },
          { user: { email: { contains: filters.search, mode: 'insensitive' as const } } },
        ],
      }),
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          bookingRef: true,
          totalAmount: true,
          bookingStatus: true,
          numTravelers: true,
          createdAt: true,
          trip: {
            select: {
              id: true, title: true, slug: true, startDate: true, endDate: true,
            },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Single booking with full detail for admin dispute review.
   * Includes traveler details, payment transactions, trip, and user info.
   * Used by: AdminService.getBookingDetail()
   */
  async findByIdAdmin(id: string) {
    return this.prisma.booking.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        bookingRef: true,
        totalAmount: true,
        bookingStatus: true,
        numTravelers: true,
        walletAmount: true,
        cancellationReason: true,
        cancelledAt: true,
        createdAt: true,
        trip: {
          select: {
            id: true, title: true, slug: true, startDate: true, endDate: true,
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        travelerDetails: {
          where: { isDeleted: false },
          select: {
            id: true, name: true, phone: true, age: true, gender: true, isPrimary: true,
            assignedSeat: ASSIGNED_SEAT_SELECT,
          },
        },
        paymentTransactions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, type: true, status: true, amount: true, createdAt: true,
            razorpayPaymentId: true, razorpayRefundId: true,
          },
        },
      },
    })
  }

  /**
   * Returns CONFIRMED/COMPLETED bookings for a trip, with user info and
   * any existing CASHBACK wallet transactions for duplicate detection.
   * Used by: AdminService.getTripCashbackDetail()
   */
  async findConfirmedByTripForCashback(tripId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        tripId,
        bookingStatus: { in: ['CONFIRMED', 'COMPLETED'] },
        isDeleted: false,
      },
      select: {
        id: true,
        userId: true,
        totalAmount: true,
        numTravelers: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Fetch existing CASHBACK transactions for these bookings in one query
    const bookingIds = bookings.map((b) => b.id)
    const cashbackTxns = bookingIds.length
      ? await this.prisma.walletTransaction.findMany({
          where: {
            type: WALLET_TX.CASHBACK,
            referenceModel: WALLET_REFERENCE_MODELS.BOOKING,
            referenceId: { in: bookingIds },
          },
          select: {
            referenceId: true,
            amount: true,
            createdAt: true,
          },
        })
      : []

    const cashbackMap = new Map(
      cashbackTxns.map((tx) => [tx.referenceId, { amount: tx.amount, issuedAt: tx.createdAt }]),
    )

    return bookings.map((b) => {
      const cb = cashbackMap.get(b.id)
      return {
        bookingId: b.id,
        userId: b.user.id,
        userName: b.user.name,
        email: b.user.email,
        totalAmount: b.totalAmount,
        numTravelers: b.numTravelers,
        cashbackIssued: cb?.amount ?? null,
        issuedAt: cb?.issuedAt?.toISOString() ?? null,
      }
    })
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
