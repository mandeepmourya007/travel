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
    const [data, total] = await this.prisma.$transaction([
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
    const [data, total] = await this.prisma.$transaction([
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
    const [data, total] = await this.prisma.$transaction([
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
    const [totalPaid, totalRefunded, pendingRefunds, transactionCount] =
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.aggregate({
          where: { booking: { userId }, type: 'PAYMENT', status: 'CAPTURED' },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: { booking: { userId }, type: 'REFUND', status: 'CAPTURED' },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: { booking: { userId }, type: 'REFUND', status: 'INITIATED' },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.count({
          where: { booking: { userId } },
        }),
      ])
    return {
      totalPaid: totalPaid._sum.amount ?? 0,
      totalRefunded: totalRefunded._sum.amount ?? 0,
      pendingRefunds: pendingRefunds._sum.amount ?? 0,
      transactionCount,
    }
  }

  /**
   * Aggregate summary for a trip's payments.
   *
   * Returns raw aggregates — commission is calculated in the service layer.
   * Used by: PaymentHistoryService.getTripPaymentSummary()
   */
  async getTripSummary(tripId: string) {
    const [revenue, refunded, txCount, refundCount] =
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.aggregate({
          where: { booking: { tripId }, type: 'PAYMENT', status: 'CAPTURED' },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: { booking: { tripId }, type: 'REFUND', status: 'CAPTURED' },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.count({
          where: { booking: { tripId } },
        }),
        this.prisma.paymentTransaction.count({
          where: { booking: { tripId }, type: 'REFUND' },
        }),
      ])
    return {
      totalRevenue: revenue._sum.amount ?? 0,
      totalRefunded: refunded._sum.amount ?? 0,
      transactionCount: txCount,
      refundCount,
    }
  }

  /**
   * Global aggregate for admin dashboard.
   *
   * Used by: PaymentHistoryService.getGlobalSummary()
   */
  async getGlobalSummary() {
    const [revenue, refunded, txCount, failedCount] =
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.aggregate({
          where: { type: 'PAYMENT', status: 'CAPTURED' },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: { type: 'REFUND', status: 'CAPTURED' },
          _sum: { amount: true },
        }),
        this.prisma.paymentTransaction.count({}),
        this.prisma.paymentTransaction.count({
          where: { status: 'FAILED' },
        }),
      ])
    return {
      totalRevenue: revenue._sum.amount ?? 0,
      totalRefunded: refunded._sum.amount ?? 0,
      transactionCount: txCount,
      failedCount,
    }
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
