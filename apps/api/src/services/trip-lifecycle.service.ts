import type { Logger } from 'pino'
import type { TripRepository } from '../repositories/trip.repository'
import type { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import type { BookingRepository } from '../repositories/booking.repository'
import type { PaymentService } from './payment.service'
import type { NotificationService } from './notification.service'
import type { WalletService } from './wallet.service'
import {
  TRIP_COMPLETION_BATCH_SIZE,
  PLATFORM_COMMISSION_PERCENT,
  PAYMENT_TX_TYPE,
  PAYMENT_TX_STATUS,
  WALLET_AUTO_CASHBACK_PERCENT,
  WALLET_AUTO_CASHBACK_CAP,
  WALLET_CREDIT_EXPIRY_DAYS,
} from '../utils/constants'
import { TRIP_STATUS, BOOKING_STATUS, NOTIFICATION_TYPE } from '@shared/constants'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'
import { Prisma } from '@prisma/client'

export class TripLifecycleService {
  constructor(
    private tripRepo: TripRepository,
    private paymentTxRepo: PaymentTransactionRepository,
    private paymentService: PaymentService | null,
    private logger: Logger,
    private notificationService: NotificationService | null = null,
    private walletService: WalletService | null = null,
    private bookingRepo: BookingRepository | null = null,
  ) {}

  /**
   * Cron entry point: finds ACTIVE/FULL trips past endDate → COMPLETED.
   * Batch-limited to prevent Razorpay rate-limit hits and cron timeouts.
   *
   * For each trip:
   * 1. DB Transaction: trip→COMPLETED, bookings→COMPLETED, organizer stats++, destination tripCount--
   * 2. Release SafePay (outside tx — Razorpay failure must not rollback DB changes)
   *
   * @returns { completed: number; safePayReleased: number; safePayFailed: number }
   */
  async completeEndedTrips() {
    const trips = await this.tripRepo.findTripsToComplete(TRIP_COMPLETION_BATCH_SIZE)

    if (trips.length === 0) return { completed: 0, safePayReleased: 0, safePayFailed: 0 }

    this.logger.info({ count: trips.length }, 'Processing trip completions')

    let completed = 0
    let safePayReleased = 0
    let safePayFailed = 0

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

        // Release SafePay outside transaction — Razorpay failure must not rollback
        try {
          const result = await this.releaseSafePayForTrip(trip.id)
          safePayReleased += result.released
          safePayFailed += result.failed
        } catch (error) {
          this.logger.error({ tripId: trip.id, error }, 'SafePay release failed for trip — will retry next cycle')
        }

        // Post-completion side-effects (notifications + cashback).
        // All are fire-and-forget — failures must not affect trip-completion outcome.
        this.sendPostCompletionSideEffects(trip.id, trip.slug, trip.title).catch((error) => {
          this.logger.error({ tripId: trip.id, error }, 'Post-completion side-effects failed')
        })
      } catch (error) {
        this.logger.error({ tripId: trip.id, error }, 'Failed to complete trip')
      }
    }

    this.logger.info({ completed, safePayReleased, safePayFailed }, 'Trip completion cron finished')
    return { completed, safePayReleased, safePayFailed }
  }

  /**
   * Releases SafePay holds for all captured payments on a specific trip.
   * Idempotent — skips bookings that already have an ESCROW_RELEASE record.
   *
   * If Razorpay API fails for one booking, logs error and continues with next.
   *
   * @returns { released: number; failed: number; skipped: number }
   */
  async releaseSafePayForTrip(tripId: string): Promise<{ released: number; failed: number; skipped: number }> {
    if (!this.paymentService) {
      this.logger.warn({ tripId }, 'Payment service not configured — skipping SafePay release')
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
   * Crash recovery: finds COMPLETED trips with unreleased SafePays and releases them.
   * Catches any SafePay releases that failed in previous cron runs.
   * Called after completeEndedTrips() in the same cron cycle.
   */
  async releaseUnreleasedSafePays(): Promise<{ released: number; failed: number }> {
    if (!this.paymentService) {
      return { released: 0, failed: 0 }
    }

    const unreleased = await this.paymentTxRepo.findUnreleasedSafePays()

    if (unreleased.length === 0) return { released: 0, failed: 0 }

    this.logger.info({ count: unreleased.length }, 'Processing unreleased SafePays (crash recovery)')

    let released = 0
    let failed = 0

    for (const payment of unreleased) {
      const tripId = 'tripId' in payment.booking ? (payment.booking as { tripId: string }).tripId : undefined
      const result = await this.resolveAndRelease(payment, { tripId, crashRecovery: true })
      if (result === 'released') released++
      else failed++
    }

    if (released > 0 || failed > 0) {
      this.logger.info({ released, failed }, 'Crash recovery SafePay sweep finished')
    }

    return { released, failed }
  }

  // ─── Private Helpers ──────────────────────────────────

  /**
   * Core SafePay release logic for a single payment.
   * Shared by releaseSafePayForTrip and releaseUnreleasedSafePays.
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
        markupAmount: number
        trip: { organizer: { commissionRate: Prisma.Decimal | null } }
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
          'No transfer ID — cannot release SafePay',
        )
        return 'failed'
      }

      // Calculate actual transfer amount (organizer's share).
      // Base-only: reseller markup (booking.markupAmount) is track-only and must
      // never enter the escrow-release ledger — it's 0 for non-reseller bookings,
      // so this is byte-identical to the pre-markup calculation in that case.
      const rawRate = payment.booking.trip.organizer.commissionRate
      const commissionRate = rawRate != null ? Number(rawRate) : PLATFORM_COMMISSION_PERCENT
      const baseAmount = payment.booking.totalAmount - payment.booking.markupAmount
      const transferAmount = Math.round(baseAmount * (1 - commissionRate / 100))

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
          // Duplicate — another instance already recorded (and presumably released) this SafePay.
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
        'SafePay released for booking',
      )
      return 'released'
    } catch (error) {
      this.logger.error(
        { bookingId: payment.bookingId, error, crashRecovery: meta.crashRecovery },
        'Failed to release SafePay for booking — will retry next cycle',
      )
      return 'failed'
    }
  }

  /**
   * Fires review-request notifications and auto-cashback credits for every
   * completed booking on a trip. Called post-commit, fire-and-forget.
   *
   * Both effects are idempotent:
   * - REVIEW_REQUEST fires once per trip completion (trip never re-enters ACTIVE).
   * - Cashback is guarded by @@unique([type, referenceModel, referenceId]) — P2002
   *   is caught and treated as already-issued.
   */
  private async sendPostCompletionSideEffects(
    tripId: string,
    tripSlug: string,
    tripTitle: string,
  ): Promise<void> {
    if (!this.bookingRepo) return

    const bookings = await this.bookingRepo.findConfirmedByTripForCashback(tripId)
    if (bookings.length === 0) return

    const autoCashbackEnabled = WALLET_AUTO_CASHBACK_PERCENT > 0 && WALLET_AUTO_CASHBACK_CAP > 0

    await Promise.allSettled(
      bookings.map(async (booking) => {
        // ── Review request notification ───────────────────
        if (this.notificationService) {
          this.notificationService
            .send({
              userId: booking.userId,
              type: NOTIFICATION_TYPE.REVIEW_REQUEST,
              title: 'How was your trip?',
              body: `You recently completed "${tripTitle}". Share your experience to help future travelers.`,
              data: { tripSlug, tripName: tripTitle },
            })
            .catch((err) => {
              this.logger.warn({ bookingId: booking.bookingId, err }, 'Review request notification failed')
            })
        }

        // ── Auto-cashback (config-gated) ──────────────────
        // Base-only: reseller markup must never fund cashback — markupAmount is 0
        // for non-reseller bookings, so this is byte-identical to before for them.
        if (autoCashbackEnabled && this.walletService && booking.cashbackIssued === null) {
          const cashbackBasis = booking.totalAmount - booking.markupAmount
          const rawAmount = Math.round(cashbackBasis * WALLET_AUTO_CASHBACK_PERCENT / 100)
          const amount = Math.min(rawAmount, WALLET_AUTO_CASHBACK_CAP, cashbackBasis)
          if (amount <= 0) return

          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + WALLET_CREDIT_EXPIRY_DAYS)

          try {
            await this.walletService.credit({
              userId: booking.userId,
              amount,
              type: WALLET_TX.CASHBACK,
              referenceModel: WALLET_REFERENCE_MODELS.BOOKING,
              referenceId: booking.bookingId,
              description: `Cashback for completing "${tripTitle}"`,
              expiresAt,
            })
            this.logger.info({ bookingId: booking.bookingId, amount }, 'Auto-cashback credited')
          } catch (err: unknown) {
            // P2002 = already issued (race or manual admin cashback ran first) — safe to ignore
            const isUniqueViolation = err instanceof Error && (err as { code?: unknown }).code === 'P2002'
            if (!isUniqueViolation) {
              this.logger.warn({ bookingId: booking.bookingId, err }, 'Auto-cashback credit failed')
            }
          }
        }
      }),
    )
  }
}
