import type { PaymentStatus, PaymentType, Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

const BOOKING_SELECT_BASE = {
  id: true,
  bookingRef: true,
  bookingStatus: true,
  trip: {
    select: {
      id: true,
      title: true,
      slug: true,
      destination: { select: { name: true } },
    },
  },
} as const

const BOOKING_SELECT_WITH_USER = {
  ...BOOKING_SELECT_BASE,
  user: { select: { id: true, name: true, email: true } },
} as const

export class PaymentTransactionRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Creates a new payment transaction record.
   *
   * Used by: BookingService.createBooking() — records the initial INITIATED transaction
   * Used by: PaymentService.handlePaymentFailed() — records a FAILED transaction
   */
  async create(data: {
    bookingId: string
    type: PaymentType
    amount: number
    currency?: string
    razorpayOrderId?: string
    razorpayPaymentId?: string
    razorpayRefundId?: string
    razorpayTransferId?: string
    status?: PaymentStatus
    failureReason?: string
    metadata?: Prisma.InputJsonValue
  }) {
    return this.prisma.paymentTransaction.create({ data })
  }

  /**
   * Finds all payment transactions for a booking, ordered by creation date.
   *
   * WHERE: bookingId
   * Used by: Admin dashboard, reconciliation
   */
  async findByBookingId(bookingId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Finds a payment transaction by Razorpay order ID.
   *
   * WHERE: razorpayOrderId (indexed)
   * Used by: Webhook handler — resolves internal booking from Razorpay order
   *
   * Edge case: Returns null if order ID not found (orphan webhook)
   */
  async findByRazorpayOrderId(orderId: string) {
    return this.prisma.paymentTransaction.findFirst({
      where: { razorpayOrderId: orderId },
    })
  }

  /**
   * Finds a payment transaction by Razorpay payment ID.
   *
   * WHERE: razorpayPaymentId (indexed)
   * Used by: Webhook handler — refund.processed lookup
   *
   * Edge case: Returns null if payment ID not found
   */
  async findByRazorpayPaymentId(paymentId: string) {
    return this.prisma.paymentTransaction.findFirst({
      where: { razorpayPaymentId: paymentId },
    })
  }

  /**
   * Updates payment transaction status with optional metadata.
   *
   * Used by: Every payment state transition (INITIATED→AUTHORIZED→CAPTURED, FAILED, REFUNDED)
   */
  async updateStatus(
    id: string,
    status: PaymentStatus,
    extras?: {
      failureReason?: string
      metadata?: Prisma.InputJsonValue
      razorpayPaymentId?: string
      razorpayRefundId?: string
      razorpayTransferId?: string
    },
  ) {
    return this.prisma.paymentTransaction.update({
      where: { id },
      data: { status, ...extras },
    })
  }

  /**
   * Sets the Razorpay payment ID after authorization.
   *
   * Used by: PaymentService.handlePaymentAuthorized()
   */
  async updatePaymentId(id: string, razorpayPaymentId: string) {
    return this.prisma.paymentTransaction.update({
      where: { id },
      data: { razorpayPaymentId },
    })
  }

  // ─── Payment History Queries ────────────────────────

  /**
   * Finds payment transactions for a specific user (via booking.userId).
   *
   * WHERE: booking.userId = userId
   * JOIN: booking → trip → destination
   * Used by: PaymentHistoryService.getMyPayments()
   */
  async findByUserId(
    userId: string,
    filters: { type?: string; status?: string; fromDate?: string; toDate?: string },
    pagination: { skip: number; take: number },
  ) {
    const where = this.buildPaymentWhere({ ...filters, userId })
    const [data, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        include: { booking: { select: BOOKING_SELECT_BASE } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.paymentTransaction.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Finds payment transactions for a specific trip (via booking.tripId).
   *
   * WHERE: booking.tripId = tripId
   * JOIN: booking → user (name, email) for organizer view
   * Used by: PaymentHistoryService.getTripPayments()
   */
  async findByTripId(
    tripId: string,
    filters: { type?: string; status?: string; fromDate?: string; toDate?: string },
    pagination: { skip: number; take: number },
  ) {
    const where = this.buildPaymentWhere({ ...filters, tripId })
    const [data, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        include: { booking: { select: BOOKING_SELECT_WITH_USER } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.paymentTransaction.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Admin-only: finds all payment transactions with optional filters.
   *
   * WHERE: optional userId, tripId, bookingRef, type, status, date range
   * Used by: PaymentHistoryService.getAllPayments()
   */
  async findAll(
    filters: {
      type?: string; status?: string; fromDate?: string; toDate?: string
      userId?: string; tripId?: string; bookingRef?: string
    },
    pagination: { skip: number; take: number },
  ) {
    const where = this.buildPaymentWhere(filters)
    const [data, total] = await Promise.all([
      this.prisma.paymentTransaction.findMany({
        where,
        include: { booking: { select: BOOKING_SELECT_WITH_USER } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.paymentTransaction.count({ where }),
    ])
    return { data, total }
  }

  /**
   * Aggregate summary for a user's payments.
   *
   * Returns: totalPaid (CAPTURED PAYMENTs), totalRefunded (CAPTURED REFUNDs),
   *          pendingRefunds (INITIATED REFUNDs), transactionCount
   * Used by: PaymentHistoryService.getMyPaymentSummary()
   */
  async getUserSummary(userId: string) {
    const [groups, transactionCount] = await Promise.all([
      this.prisma.paymentTransaction.groupBy({
        by: ['type', 'status'],
        _sum: { amount: true },
        where: {
          booking: { userId },
          type: { in: ['PAYMENT', 'REFUND'] },
          status: { in: ['CAPTURED', 'INITIATED'] },
        },
      }),
      this.prisma.paymentTransaction.count({
        where: { booking: { userId } },
      }),
    ])
    let totalPaid = 0
    let totalRefunded = 0
    let pendingRefunds = 0
    for (const g of groups) {
      const amt = g._sum.amount ?? 0
      if (g.type === 'PAYMENT' && g.status === 'CAPTURED') totalPaid = amt
      if (g.type === 'REFUND' && g.status === 'CAPTURED') totalRefunded = amt
      if (g.type === 'REFUND' && g.status === 'INITIATED') pendingRefunds = amt
    }
    return { totalPaid, totalRefunded, pendingRefunds, transactionCount }
  }

  /**
   * Aggregate summary for a trip's payments.
   *
   * Returns raw aggregates — commission is calculated in the service layer.
   * Used by: PaymentHistoryService.getTripPaymentSummary()
   */
  async getTripSummary(tripId: string) {
    const [groups, txCount, refundCount] = await Promise.all([
      this.prisma.paymentTransaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
        where: {
          booking: { tripId },
          status: 'CAPTURED',
          type: { in: ['PAYMENT', 'REFUND'] },
        },
      }),
      this.prisma.paymentTransaction.count({
        where: { booking: { tripId } },
      }),
      this.prisma.paymentTransaction.count({
        where: { booking: { tripId }, type: 'REFUND' },
      }),
    ])
    let totalRevenue = 0
    let totalRefunded = 0
    for (const g of groups) {
      if (g.type === 'PAYMENT') totalRevenue = g._sum.amount ?? 0
      if (g.type === 'REFUND') totalRefunded = g._sum.amount ?? 0
    }
    return { totalRevenue, totalRefunded, transactionCount: txCount, refundCount }
  }

  /**
   * Global aggregate for admin dashboard.
   *
   * Used by: PaymentHistoryService.getGlobalSummary()
   */
  async getGlobalSummary() {
    const [groups, txCount, failedCount] = await Promise.all([
      this.prisma.paymentTransaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
        where: {
          status: 'CAPTURED',
          type: { in: ['PAYMENT', 'REFUND'] },
        },
      }),
      this.prisma.paymentTransaction.count({}),
      this.prisma.paymentTransaction.count({
        where: { status: 'FAILED' },
      }),
    ])
    let totalRevenue = 0
    let totalRefunded = 0
    for (const g of groups) {
      if (g.type === 'PAYMENT') totalRevenue = g._sum.amount ?? 0
      if (g.type === 'REFUND') totalRefunded = g._sum.amount ?? 0
    }
    return { totalRevenue, totalRefunded, transactionCount: txCount, failedCount }
  }

  // ─── Escrow Release Queries ────────────────────────

  /**
   * Finds CAPTURED PAYMENT transactions for a trip.
   * Used by: TripLifecycleService.releaseEscrowForTrip()
   *
   * Includes payments with AND without razorpayTransferId —
   * the service lazy-fetches missing transfer IDs from Razorpay.
   */
  async findCapturedTransfersForTrip(tripId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: {
        type: 'PAYMENT',
        status: 'CAPTURED',
        // Only release escrow for bookings that completed — CANCELLED bookings must never receive a transfer
        booking: { tripId, isDeleted: false, bookingStatus: { in: ['CONFIRMED', 'COMPLETED'] } },
      },
      select: {
        id: true,
        bookingId: true,
        amount: true,
        razorpayTransferId: true,
        razorpayPaymentId: true,
        booking: {
          select: {
            totalAmount: true,
            trip: {
              select: {
                organizer: {
                  select: { commissionRate: true },
                },
              },
            },
          },
        },
      },
    })
  }

  /**
   * Finds CAPTURED payments with transfer IDs on COMPLETED trips
   * that do NOT yet have a corresponding ESCROW_RELEASE record.
   * Used by: TripLifecycleService.releaseUnreleasedEscrows() — crash recovery.
   *
   * Groups by tripId for batch processing.
   */
  async findUnreleasedEscrows() {
    // Subquery: booking IDs that already have an ESCROW_RELEASE
    const releasedBookingIds = await this.prisma.paymentTransaction.findMany({
      where: { type: 'ESCROW_RELEASE' },
      select: { bookingId: true },
      distinct: ['bookingId'],
    })
    const releasedSet = new Set(releasedBookingIds.map((r) => r.bookingId))

    const unreleased = await this.prisma.paymentTransaction.findMany({
      where: {
        type: 'PAYMENT',
        status: 'CAPTURED',
        // Only crash-recover escrow for bookings that actually completed
        booking: {
          isDeleted: false,
          bookingStatus: { in: ['CONFIRMED', 'COMPLETED'] },
          trip: { status: 'COMPLETED', isDeleted: false },
        },
      },
      select: {
        id: true,
        bookingId: true,
        amount: true,
        razorpayTransferId: true,
        razorpayPaymentId: true,
        booking: {
          select: {
            tripId: true,
            totalAmount: true,
            trip: {
              select: {
                organizer: {
                  select: { commissionRate: true },
                },
              },
            },
          },
        },
      },
    })

    return unreleased.filter((tx) => !releasedSet.has(tx.bookingId))
  }

  /**
   * Finds the most recent REFUND transaction in INITIATED state for a booking.
   * Used by handleRefundProcessed to mark the correct tx as REFUNDED when the
   * refund.processed webhook fires — the REFUND tx has no razorpayPaymentId so it
   * cannot be found via findByRazorpayPaymentId.
   * Used by: PaymentService.handleRefundProcessed()
   */
  async findInitiatedRefundByBookingId(bookingId: string) {
    return this.prisma.paymentTransaction.findFirst({
      where: {
        bookingId,
        type: 'REFUND',
        status: 'INITIATED',
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Returns the set of bookingIds on a trip that already have an ESCROW_RELEASE record.
   * Replaces the N+1 findByBookingId loop in TripLifecycleService.releaseEscrowForTrip().
   * Used by: TripLifecycleService.releaseEscrowForTrip()
   */
  async findReleasedBookingIdsForTrip(tripId: string): Promise<Set<string>> {
    const rows = await this.prisma.paymentTransaction.findMany({
      where: {
        type: 'ESCROW_RELEASE',
        booking: { tripId },
      },
      select: { bookingId: true },
      distinct: ['bookingId'],
    })
    return new Set(rows.map((r) => r.bookingId))
  }

  /**
   * Returns ESCROW_RELEASE transactions for an organizer's trips, scoped to
   * a specific trip if provided. Used for payout statements.
   */
  async findEscrowReleasesForOrganizer(organizerId: string, tripId?: string) {
    return this.prisma.paymentTransaction.findMany({
      where: {
        type: 'ESCROW_RELEASE',
        booking: {
          trip: {
            organizerId,
            ...(tripId ? { id: tripId } : {}),
          },
        },
      },
      select: {
        id: true,
        amount: true,
        status: true,
        razorpayTransferId: true,
        metadata: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            bookingRef: true,
            totalAmount: true,
            trip: {
              select: { id: true, slug: true, title: true, startDate: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Returns total captured-payment amount for an organizer's trips that do NOT
   * yet have an ESCROW_RELEASE record — i.e., the pending payout amount.
   */
  async findPendingEscrowForOrganizer(organizerId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: {
        type: 'PAYMENT',
        status: 'CAPTURED',
        booking: {
          trip: { organizerId },
          NOT: {
            paymentTransactions: {
              some: { type: 'ESCROW_RELEASE' },
            },
          },
        },
      },
      select: {
        amount: true,
        booking: {
          select: {
            trip: {
              select: { id: true, title: true, organizerId: true, organizer: { select: { commissionRate: true } } },
            },
          },
        },
      },
    })
  }

  // ─── Private helpers ────────────────────────────────

  /**
   * Builds Prisma WHERE clause from optional filters.
   * Pattern: Builder pattern (see tech-stack.md Section 1)
   */
  private buildPaymentWhere(filters: {
    type?: string; status?: string; fromDate?: string; toDate?: string
    userId?: string; tripId?: string; bookingRef?: string
  }): Prisma.PaymentTransactionWhereInput {
    const createdAt: Record<string, Date> = {}
    if (filters.fromDate) createdAt.gte = new Date(filters.fromDate)
    if (filters.toDate) createdAt.lte = new Date(filters.toDate)

    return {
      ...(filters.type && { type: filters.type as PaymentType }),
      ...(filters.status && { status: filters.status as PaymentStatus }),
      ...(Object.keys(createdAt).length > 0 && { createdAt }),
      ...(filters.userId || filters.tripId || filters.bookingRef
        ? {
            booking: {
              ...(filters.userId && { userId: filters.userId }),
              ...(filters.tripId && { tripId: filters.tripId }),
              ...(filters.bookingRef && {
                bookingRef: { contains: filters.bookingRef, mode: 'insensitive' as const },
              }),
            },
          }
        : {}),
    }
  }
}
