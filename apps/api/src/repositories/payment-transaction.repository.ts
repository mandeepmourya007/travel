import type { PaymentStatus, PaymentType, Prisma } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'

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
}
