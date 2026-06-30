import type { PaymentStatus, PaymentType, Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import { BOOKING_STATUS, TRIP_STATUS } from '@shared/constants'
import { PAYMENT_TX_TYPE, PAYMENT_TX_STATUS } from '../utils/constants'

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

  /**
   * Increments the retryCount in the transaction's metadata and stamps lastRetryAt.
   * Used by the refund retry path for ops visibility — does not change status.
   */
  async recordRetryAttempt(id: string, existingMetadata: Prisma.JsonValue | null) {
    const base = typeof existingMetadata === 'object' && existingMetadata !== null && !Array.isArray(existingMetadata)
      ? (existingMetadata as Record<string, unknown>)
      : {}
    return this.prisma.paymentTransaction.update({
      where: { id },
      data: {
        metadata: {
          ...base,
          retryCount: ((base.retryCount as number | undefined) ?? 0) + 1,
          lastRetryAt: new Date().toISOString(),
        },
      },
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
   * Returns: totalPaid (CAPTURED PAYMENTs), totalRefunded (REFUNDED REFUNDs),
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
          type: { in: [PAYMENT_TX_TYPE.PAYMENT, PAYMENT_TX_TYPE.REFUND] },
          // CAPTURED: completed payments; REFUNDED: completed refunds; INITIATED: pending refunds
          status: { in: [PAYMENT_TX_STATUS.CAPTURED, PAYMENT_TX_STATUS.REFUNDED, PAYMENT_TX_STATUS.INITIATED] },
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
      if (g.type === PAYMENT_TX_TYPE.PAYMENT && g.status === PAYMENT_TX_STATUS.CAPTURED) totalPaid = amt
      // Refund txs lifecycle: INITIATED → REFUNDED (never CAPTURED)
      if (g.type === PAYMENT_TX_TYPE.REFUND && g.status === PAYMENT_TX_STATUS.REFUNDED) totalRefunded = amt
      if (g.type === PAYMENT_TX_TYPE.REFUND && g.status === PAYMENT_TX_STATUS.INITIATED) pendingRefunds = amt
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
        by: ['type', 'status'],
        _sum: { amount: true },
        where: {
          booking: { tripId },
          // Include both terminal statuses: CAPTURED (payments) and REFUNDED (refunds)
          status: { in: [PAYMENT_TX_STATUS.CAPTURED, PAYMENT_TX_STATUS.REFUNDED] },
          type: { in: [PAYMENT_TX_TYPE.PAYMENT, PAYMENT_TX_TYPE.REFUND] },
        },
      }),
      this.prisma.paymentTransaction.count({
        where: { booking: { tripId } },
      }),
      // Only count refunds that actually completed — INITIATED/FAILED are not yet processed
      this.prisma.paymentTransaction.count({
        where: { booking: { tripId }, type: PAYMENT_TX_TYPE.REFUND, status: PAYMENT_TX_STATUS.REFUNDED },
      }),
    ])
    let totalRevenue = 0
    let totalRefunded = 0
    for (const g of groups) {
      // PAYMENT txs are CAPTURED when complete; REFUND txs are REFUNDED (not CAPTURED)
      if (g.type === PAYMENT_TX_TYPE.PAYMENT && g.status === PAYMENT_TX_STATUS.CAPTURED) totalRevenue = g._sum.amount ?? 0
      if (g.type === PAYMENT_TX_TYPE.REFUND && g.status === PAYMENT_TX_STATUS.REFUNDED) totalRefunded = g._sum.amount ?? 0
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
        by: ['type', 'status'],
        _sum: { amount: true },
        where: {
          status: { in: [PAYMENT_TX_STATUS.CAPTURED, PAYMENT_TX_STATUS.REFUNDED] },
          type: { in: [PAYMENT_TX_TYPE.PAYMENT, PAYMENT_TX_TYPE.REFUND] },
        },
      }),
      this.prisma.paymentTransaction.count({}),
      this.prisma.paymentTransaction.count({
        where: { status: PAYMENT_TX_STATUS.FAILED },
      }),
    ])
    let totalRevenue = 0
    let totalRefunded = 0
    for (const g of groups) {
      if (g.type === PAYMENT_TX_TYPE.PAYMENT && g.status === PAYMENT_TX_STATUS.CAPTURED) totalRevenue = g._sum.amount ?? 0
      if (g.type === PAYMENT_TX_TYPE.REFUND && g.status === PAYMENT_TX_STATUS.REFUNDED) totalRefunded = g._sum.amount ?? 0
    }
    return { totalRevenue, totalRefunded, transactionCount: txCount, failedCount }
  }

  // ─── SafePay Release Queries ────────────────────────

  /**
   * Finds CAPTURED PAYMENT transactions for a trip.
   * Used by: TripLifecycleService.releaseSafePayForTrip()
   *
   * Includes payments with AND without razorpayTransferId —
   * the service lazy-fetches missing transfer IDs from Razorpay.
   */
  async findCapturedTransfersForTrip(tripId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: {
        type: PAYMENT_TX_TYPE.PAYMENT,
        status: PAYMENT_TX_STATUS.CAPTURED,
        // Only release SafePay for bookings that completed — CANCELLED bookings must never receive a transfer
        booking: { tripId, isDeleted: false, bookingStatus: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] } },
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
   * Used by: TripLifecycleService.releaseUnreleasedSafePays() — crash recovery.
   *
   * Groups by tripId for batch processing.
   */
  async findUnreleasedSafePays() {
    // Subquery: booking IDs that already have an ESCROW_RELEASE
    const releasedBookingIds = await this.prisma.paymentTransaction.findMany({
      where: { type: 'ESCROW_RELEASE' },
      select: { bookingId: true },
      distinct: ['bookingId'],
    })
    const releasedSet = new Set(releasedBookingIds.map((r) => r.bookingId))

    const unreleased = await this.prisma.paymentTransaction.findMany({
      where: {
        type: PAYMENT_TX_TYPE.PAYMENT,
        status: PAYMENT_TX_STATUS.CAPTURED,
        // Only crash-recover SafePay for bookings that actually completed
        booking: {
          isDeleted: false,
          bookingStatus: { in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED] },
          trip: { status: TRIP_STATUS.COMPLETED, isDeleted: false },
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
        type: PAYMENT_TX_TYPE.REFUND,
        status: PAYMENT_TX_STATUS.INITIATED,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Returns the set of bookingIds on a trip that already have an ESCROW_RELEASE record.
   * Replaces the N+1 findByBookingId loop in TripLifecycleService.releaseSafePayForTrip().
   * Used by: TripLifecycleService.releaseSafePayForTrip()
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
  async findSafePayReleasesForOrganizer(organizerId: string, tripId?: string) {
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
  async findPendingSafePayForOrganizer(organizerId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: {
        type: PAYMENT_TX_TYPE.PAYMENT,
        status: PAYMENT_TX_STATUS.CAPTURED,
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
