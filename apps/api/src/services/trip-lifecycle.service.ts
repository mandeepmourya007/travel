import type { Logger } from 'pino'
import type { TripRepository } from '../repositories/trip.repository'
import type { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import type { PaymentService } from './payment.service'
import { TRIP_COMPLETION_BATCH_SIZE, PLATFORM_COMMISSION_PERCENT, PAYMENT_TX_TYPE, PAYMENT_TX_STATUS } from '../utils/constants'
import { TRIP_STATUS, BOOKING_STATUS } from '@shared/constants'
import { Prisma } from '@prisma/client'

export class TripLifecycleService {
  constructor(
    private tripRepo: TripRepository,
    private paymentTxRepo: PaymentTransactionRepository,
    private paymentService: PaymentService | null,
    private logger: Logger,
  ) {}

  /**
   * Cron entry point: finds ACTIVE/FULL trips past endDate → COMPLETED.
   * Batch-limited to prevent Razorpay rate-limit hits and cron timeouts.
   *
   * For each trip:
   * 1. DB Transaction: trip→COMPLETED, bookings→COMPLETED, organizer stats++, destination tripCount--
   * 2. Release escrow (outside tx — Razorpay failure must not rollback DB changes)
   *
   * @returns { completed: number; escrowReleased: number; escrowFailed: number }
   */
  async completeEndedTrips() {
    const trips = await this.tripRepo.findTripsToComplete(TRIP_COMPLETION_BATCH_SIZE)

    if (trips.length === 0) return { completed: 0, escrowReleased: 0, escrowFailed: 0 }

    this.logger.info({ count: trips.length }, 'Processing trip completions')

    let completed = 0
    let escrowReleased = 0
    let escrowFailed = 0

    for (const trip of trips) {
      try {
        // Atomic: trip status + booking status + organizer stats + destination count
        await this.tripRepo.withTransaction(async (tx) => {
          await tx.trip.update({
            where: { id: trip.id },
            data: { status: TRIP_STATUS.COMPLETED, updatedAt: new Date() },
          })
          await tx.booking.updateMany({
            where: {
              tripId: trip.id,
              bookingStatus: BOOKING_STATUS.CONFIRMED,
              isDeleted: false,
            },
            data: { bookingStatus: BOOKING_STATUS.COMPLETED },
          })
          await tx.organizerProfile.update({
            where: { id: trip.organizerId },
            data: { totalTripsCompleted: { increment: 1 } },
          })
          await tx.destination.update({
            where: { id: trip.destinationId },
            data: { tripCount: { decrement: 1 } },
          })
        })

        completed++
        this.logger.info({ tripId: trip.id }, 'Trip marked COMPLETED')

        // Release escrow outside transaction — Razorpay failure must not rollback
        try {
          const result = await this.releaseEscrowForTrip(trip.id)
          escrowReleased += result.released
          escrowFailed += result.failed
        } catch (error) {
          this.logger.error({ tripId: trip.id, error }, 'Escrow release failed for trip — will retry next cycle')
        }
      } catch (error) {
        this.logger.error({ tripId: trip.id, error }, 'Failed to complete trip')
      }
    }

    this.logger.info({ completed, escrowReleased, escrowFailed }, 'Trip completion cron finished')
    return { completed, escrowReleased, escrowFailed }
  }

  /**
   * Releases escrow holds for all captured payments on a specific trip.
   * Idempotent — skips bookings that already have an ESCROW_RELEASE record.
   *
   * If Razorpay API fails for one booking, logs error and continues with next.
   *
   * @returns { released: number; failed: number; skipped: number }
   */
  async releaseEscrowForTrip(tripId: string): Promise<{ released: number; failed: number; skipped: number }> {
    if (!this.paymentService) {
      this.logger.warn({ tripId }, 'Payment service not configured — skipping escrow release')
      return { released: 0, failed: 0, skipped: 0 }
    }

    const capturedPayments = await this.paymentTxRepo.findCapturedTransfersForTrip(tripId)

    if (capturedPayments.length === 0) {
      return { released: 0, failed: 0, skipped: 0 }
    }

    // P2-2: Single query instead of N+1 findByBookingId calls
    const releasedBookingIds = await this.paymentTxRepo.findReleasedBookingIdsForTrip(tripId)

    let released = 0
    let failed = 0
    let skipped = 0

    for (const payment of capturedPayments) {
      if (releasedBookingIds.has(payment.bookingId)) {
        skipped++
        continue
      }

      const result = await this.resolveAndRelease(payment, { tripId })
      if (result === 'released') released++
      else failed++
    }

    return { released, failed, skipped }
  }

  /**
   * Crash recovery: finds COMPLETED trips with unreleased escrows and releases them.
   * Catches any escrow releases that failed in previous cron runs.
   * Called after completeEndedTrips() in the same cron cycle.
   */
  async releaseUnreleasedEscrows(): Promise<{ released: number; failed: number }> {
    if (!this.paymentService) {
      return { released: 0, failed: 0 }
    }

    const unreleased = await this.paymentTxRepo.findUnreleasedEscrows()

    if (unreleased.length === 0) return { released: 0, failed: 0 }

    this.logger.info({ count: unreleased.length }, 'Processing unreleased escrows (crash recovery)')

    let released = 0
    let failed = 0

    for (const payment of unreleased) {
      const tripId = 'tripId' in payment.booking ? (payment.booking as { tripId: string }).tripId : undefined
      const result = await this.resolveAndRelease(payment, { tripId, crashRecovery: true })
      if (result === 'released') released++
      else failed++
    }

    if (released > 0 || failed > 0) {
      this.logger.info({ released, failed }, 'Crash recovery escrow sweep finished')
    }

    return { released, failed }
  }

  // ─── Private Helpers ──────────────────────────────────

  /**
   * Core escrow release logic for a single payment.
   * Shared by releaseEscrowForTrip and releaseUnreleasedEscrows.
   *
   * Steps:
   * 1. Lazy-fetch transfer ID from Razorpay if missing
   * 2. Release hold via Razorpay API
   * 3. Record ESCROW_RELEASE transaction for audit trail
   *
   * @returns 'released' on success, 'failed' on any error
   */
  private async resolveAndRelease(
    payment: {
      id: string
      bookingId: string
      razorpayTransferId: string | null
      razorpayPaymentId: string | null
      booking: {
        totalAmount: number
        trip: { organizer: { commissionRate: number | null } }
      }
    },
    meta: { tripId?: string; crashRecovery?: boolean },
  ): Promise<'released' | 'failed'> {
    try {
      // Lazy fetch transfer ID if missing (crash recovery / webhook timing)
      let transferId = payment.razorpayTransferId
      if (!transferId && payment.razorpayPaymentId) {
        transferId = await this.paymentService!.fetchTransferId(payment.razorpayPaymentId)
        if (transferId) {
          await this.paymentTxRepo.updateStatus(payment.id, PAYMENT_TX_STATUS.CAPTURED, { razorpayTransferId: transferId })
        }
      }

      if (!transferId) {
        this.logger.warn(
          { bookingId: payment.bookingId, paymentTxId: payment.id, crashRecovery: meta.crashRecovery },
          'No transfer ID — cannot release escrow',
        )
        return 'failed'
      }

      // Calculate actual transfer amount (organizer's share)
      const commissionRate = payment.booking.trip.organizer.commissionRate ?? PLATFORM_COMMISSION_PERCENT
      const transferAmount = Math.round(payment.booking.totalAmount * (1 - commissionRate / 100))

      // Record ESCROW_RELEASE BEFORE calling Razorpay.
      // The partial unique index on PaymentTransaction(bookingId) WHERE type='ESCROW_RELEASE'
      // means a concurrent cron run that slipped past the pre-flight check will hit P2002 here
      // instead of issuing a duplicate Razorpay transfer release.
      try {
        await this.paymentTxRepo.create({
          bookingId: payment.bookingId,
          type: PAYMENT_TX_TYPE.ESCROW_RELEASE,
          amount: transferAmount,
          status: PAYMENT_TX_STATUS.CAPTURED,
          razorpayTransferId: transferId,
          metadata: {
            releasedAt: new Date().toISOString(),
            ...(meta.tripId ? { tripId: meta.tripId } : {}),
            ...(meta.crashRecovery ? { crashRecovery: true } : {}),
          },
        })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // Duplicate — another instance already recorded (and presumably released) this escrow.
          // Do NOT call releaseTransferHold again.
          this.logger.warn(
            { bookingId: payment.bookingId, transferId, crashRecovery: meta.crashRecovery },
            'ESCROW_RELEASE already exists (duplicate cron run) — skipping Razorpay call',
          )
          return 'released'
        }
        throw err
      }

      // Release hold on Razorpay only after the DB row is committed
      await this.paymentService!.releaseTransferHold(transferId)

      this.logger.info(
        { bookingId: payment.bookingId, transferId, amount: transferAmount, crashRecovery: meta.crashRecovery },
        'Escrow released for booking',
      )
      return 'released'
    } catch (error) {
      this.logger.error(
        { bookingId: payment.bookingId, error, crashRecovery: meta.crashRecovery },
        'Failed to release escrow for booking — will retry next cycle',
      )
      return 'failed'
    }
  }
}
