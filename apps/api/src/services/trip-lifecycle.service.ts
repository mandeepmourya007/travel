import type { Logger } from 'pino'
import type { TripRepository } from '../repositories/trip.repository'
import type { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import type { BookingRepository } from '../repositories/booking.repository'
import type { PaymentService } from './payment.service'
import type { NotificationService } from './notification.service'
import type { WalletService } from './wallet.service'
import type { PayoutService } from './payout.service'
import {
  TRIP_COMPLETION_BATCH_SIZE,
  PLATFORM_COMMISSION_PERCENT,
  PAYMENT_TX_TYPE,
  PAYMENT_TX_STATUS,
  WALLET_AUTO_CASHBACK_PERCENT,
  WALLET_AUTO_CASHBACK_CAP,
  WALLET_CREDIT_EXPIRY_DAYS,
  PAYOUT_STRATEGY,
  RELEASE_RESULT,
} from '../utils/constants'
import { TRIP_STATUS, BOOKING_STATUS, NOTIFICATION_TYPE } from '@shared/constants'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'
import { calculateOrganizerEntitlement } from '@shared/utils/payout'
import { buildIdempotencyKey } from '../utils/idempotency'
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
    /** Delegate for the razorpayx_payouts strategy — see resolveAndRelease */
    private payoutService: PayoutService | null = null,
    /** env.PAYOUT_STRATEGY, injected rather than imported directly so this class stays
     *  testable the same way its other dependencies already are */
    private payoutStrategy: string = PAYOUT_STRATEGY.ROUTE,
  ) {}

  /**
   * Cron entry point: finds ACTIVE/FULL trips past endDate → COMPLETED.
   * Batch-limited to prevent Razorpay rate-limit hits and cron timeouts.
   *
   * For each trip:
   * 1. DB Transaction: trip→COMPLETED, bookings→COMPLETED, organizer stats++, destination tripCount--
   * 2. Post-completion side-effects (notifications, cashback) fired fire-and-forget
   *
   * NOTE: Auto-payout on trip completion is currently DISABLED — organizers need
   * partial upfront funds (hotels, flights), so payouts are triggered manually via
   * the admin portal. The `safePay*` fields in the return payload are retained as
   * zero for backward compatibility with existing callers/log consumers. Re-enable
   * by uncommenting the release block in the loop below and the matching call in
   * cron-jobs.ts (`releaseUnreleasedSafePays`).
   *
   * @returns { completed, safePayReleased, safePayInitiated, safePayFailed } —
   *   safePay* fields are always 0 while auto-payout is disabled.
   */
  async completeEndedTrips() {
    const trips = await this.tripRepo.findTripsToComplete(TRIP_COMPLETION_BATCH_SIZE)

    if (trips.length === 0) return { completed: 0, safePayReleased: 0, safePayInitiated: 0, safePayFailed: 0 }

    this.logger.info({ count: trips.length }, 'Processing trip completions')

    let completed = 0
    // Auto-payout disabled — counters retained (const 0) so the return contract
    // and log shape are unchanged for callers/monitors. See loop body below.
    const safePayReleased = 0
    const safePayInitiated = 0
    const safePayFailed = 0

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

        // Auto-payout on trip completion is DISABLED — organizers need partial
        // payments upfront (hotels, flight bookings, etc.), so payouts are now
        // triggered manually via the admin portal. Trip still transitions to
        // COMPLETED so cashback, notifications and stats still fire; only the
        // gateway payout call is skipped. Re-enable by uncommenting below and
        // the releaseUnreleasedSafePays call in cron-jobs.ts.
        //
        // try {
        //   const result = await this.releaseSafePayForTrip(trip.id)
        //   safePayReleased += result.released
        //   safePayInitiated += result.initiated
        //   safePayFailed += result.failed
        // } catch (error) {
        //   this.logger.error({ tripId: trip.id, error }, 'SafePay release failed for trip — will retry next cycle')
        // }

        // Post-completion side-effects (notifications + cashback).
        // All are fire-and-forget — failures must not affect trip-completion outcome.
        this.sendPostCompletionSideEffects(trip.id, trip.slug, trip.title).catch((error) => {
          this.logger.error({ tripId: trip.id, error }, 'Post-completion side-effects failed')
        })
      } catch (error) {
        this.logger.error({ tripId: trip.id, error }, 'Failed to complete trip')
      }
    }

    this.logger.info({ completed, safePayReleased, safePayInitiated, safePayFailed }, 'Trip completion cron finished')
    return { completed, safePayReleased, safePayInitiated, safePayFailed }
  }

  /**
   * Releases SafePay holds for all captured payments on a specific trip.
   * Idempotent — skips bookings that already have an ESCROW_RELEASE record.
   *
   * If Razorpay API fails for one booking, logs error and continues with next.
   *
   * @returns { released: number; initiated: number; failed: number; skipped: number } —
   *   `initiated` counts the razorpayx_payouts-strategy INITIATED (non-terminal) result
   *   separately from `released` (LOW-5 fix) so this doesn't overstate confirmed releases.
   */
  async releaseSafePayForTrip(tripId: string): Promise<{ released: number; initiated: number; failed: number; skipped: number }> {
    if (!this.paymentService) {
      this.logger.warn({ tripId }, 'Payment service not configured — skipping SafePay release')
      return { released: 0, initiated: 0, failed: 0, skipped: 0 }
    }

    const capturedPayments = await this.paymentTxRepo.findCapturedTransfersForTrip(tripId)

    if (capturedPayments.length === 0) {
      return { released: 0, initiated: 0, failed: 0, skipped: 0 }
    }

    // P2-2: Single query instead of N+1 findByBookingId calls
    const releasedBookingIds = await this.paymentTxRepo.findReleasedBookingIdsForTrip(tripId)

    let released = 0
    let initiated = 0
    let failed = 0
    let skipped = 0

    for (const payment of capturedPayments) {
      if (releasedBookingIds.has(payment.bookingId)) {
        skipped++
        continue
      }

      const result = await this.resolveAndRelease(payment, { tripId })
      if (result === RELEASE_RESULT.RELEASED) released++
      else if (result === RELEASE_RESULT.INITIATED) initiated++
      else if (result === RELEASE_RESULT.SKIPPED) skipped++
      else failed++
    }

    return { released, initiated, failed, skipped }
  }

  /**
   * Crash recovery: finds COMPLETED trips with unreleased SafePays and releases them.
   * Catches any SafePay releases that failed in previous cron runs.
   * Called after completeEndedTrips() in the same cron cycle.
   */
  async releaseUnreleasedSafePays(): Promise<{ released: number; initiated: number; failed: number }> {
    if (!this.paymentService) {
      return { released: 0, initiated: 0, failed: 0 }
    }

    const unreleased = await this.paymentTxRepo.findUnreleasedSafePays()

    if (unreleased.length === 0) return { released: 0, initiated: 0, failed: 0 }

    this.logger.info({ count: unreleased.length }, 'Processing unreleased SafePays (crash recovery)')

    let released = 0
    let initiated = 0
    let failed = 0

    for (const payment of unreleased) {
      const tripId = 'tripId' in payment.booking ? (payment.booking as { tripId: string }).tripId : undefined
      const result = await this.resolveAndRelease(payment, { tripId, crashRecovery: true })
      if (result === RELEASE_RESULT.RELEASED) released++
      else if (result === RELEASE_RESULT.INITIATED) initiated++
      else if (result !== RELEASE_RESULT.SKIPPED) failed++
    }

    if (released > 0 || initiated > 0 || failed > 0) {
      this.logger.info({ released, initiated, failed }, 'Crash recovery SafePay sweep finished')
    }

    return { released, initiated, failed }
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
        bookingRef: string
        totalAmount: number
        markupAmount: number
        // Frozen snapshot from booking-creation time — never read the organizer's live
        // commissionRate here (admin can edit it at any time; a booking's payout math
        // must stay pinned to the rate in effect when it was placed).
        commissionRate: Prisma.Decimal | null
        trip: { organizer: { razorpayxFundAccountId?: string | null } }
      }
    },
    meta: { tripId?: string; crashRecovery?: boolean },
  ): Promise<typeof RELEASE_RESULT.RELEASED | typeof RELEASE_RESULT.INITIATED | typeof RELEASE_RESULT.SKIPPED | typeof RELEASE_RESULT.FAILED> {
    try {
      // Calculate actual transfer amount (organizer's share).
      // Base-only: reseller markup (booking.markupAmount) is track-only and must
      // never enter the escrow-release ledger — it's 0 for non-reseller bookings,
      // so this is byte-identical to the pre-markup calculation in that case.
      // calculateOrganizerEntitlement (packages/shared/src/utils/payout.ts) is the single
      // source of truth for this formula — also used by BookingService.confirmBooking's
      // capture-time credit hook (razorpayx_payouts strategy) so the two paths can never drift.
      const rawRate = payment.booking.commissionRate
      const commissionRate = rawRate != null ? Number(rawRate) : PLATFORM_COMMISSION_PERCENT
      const transferAmount = calculateOrganizerEntitlement(
        payment.booking.totalAmount,
        payment.booking.markupAmount,
        commissionRate,
      )

      if (this.payoutStrategy === PAYOUT_STRATEGY.RAZORPAYX_PAYOUTS) {
        return this.releaseViaRazorpayX(payment, transferAmount, meta)
      }

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
        return RELEASE_RESULT.FAILED
      }

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
          return RELEASE_RESULT.RELEASED
        }
        throw err
      }

      // Release hold on Razorpay only after the DB row is committed
      await this.paymentService!.releaseTransferHold(transferId)

      this.logger.info(
        { bookingId: payment.bookingId, transferId, amount: transferAmount, crashRecovery: meta.crashRecovery },
        'SafePay released for booking',
      )
      return RELEASE_RESULT.RELEASED
    } catch (error) {
      this.logger.error(
        { bookingId: payment.bookingId, error, crashRecovery: meta.crashRecovery },
        'Failed to release SafePay for booking — will retry next cycle',
      )
      return RELEASE_RESULT.FAILED
    }
  }

  /**
   * razorpayx_payouts strategy branch of resolveAndRelease — delegates the entire
   * ledger-write + gateway-call to PayoutService.releaseRazorpayXPayout instead of the
   * inline ESCROW_RELEASE write above, so a booking is never double-written under both
   * strategies. See docs/codebase/Payments & Webhooks.md "RazorpayX Payouts".
   */
  private async releaseViaRazorpayX(
    payment: {
      id: string
      bookingId: string
      booking: {
        bookingRef: string
        trip: { organizer: { razorpayxFundAccountId?: string | null } }
      }
    },
    transferAmount: number,
    meta: { tripId?: string; crashRecovery?: boolean },
  ): Promise<typeof RELEASE_RESULT.INITIATED | typeof RELEASE_RESULT.SKIPPED | typeof RELEASE_RESULT.FAILED> {
    if (!this.payoutService) {
      this.logger.warn(
        { bookingId: payment.bookingId, crashRecovery: meta.crashRecovery },
        'PayoutService not configured — cannot release via RazorpayX',
      )
      return RELEASE_RESULT.FAILED
    }

    const fundAccountId = payment.booking.trip.organizer.razorpayxFundAccountId
    if (!fundAccountId) {
      // Expected during a strategy transition — organizer hasn't been re-linked under
      // razorpayx_payouts yet. Not a bug, so warn (not error).
      this.logger.warn(
        { bookingId: payment.bookingId, crashRecovery: meta.crashRecovery },
        'Organizer has no razorpayxFundAccountId — cannot release RazorpayX payout yet',
      )
      return RELEASE_RESULT.FAILED
    }

    // transferAmount (from resolveAndRelease) is in rupees, same unit as the
    // ESCROW_RELEASE ledger amount above — releaseRazorpayXPayout/RazorpayX's API
    // both expect paise, so convert here (single conversion point for this strategy).
    // LOW-5 fix: pass the real INITIATED/SKIPPED/FAILED result straight through instead
    // of collapsing INITIATED into RELEASED — RazorpayX Payouts' final state (CAPTURED)
    // only arrives later via webhook, so cron summary logs must not overstate confirmed
    // releases as if they were the near-synchronous Route ESCROW_RELEASE path above.
    return this.payoutService.releaseRazorpayXPayout({
      bookingId: payment.bookingId,
      bookingRef: payment.booking.bookingRef,
      fundAccountId,
      amountPaise: transferAmount * 100,
      // Hashed — bookingId alone (UUIDv7) already exceeds RazorpayX's 36-char
      // X-Payout-Idempotency limit once prefixed. Deterministic on bookingId only
      // (no time component) so a retry of the SAME booking's release always reuses
      // the same key — this is the one-release-per-booking SafePay contract.
      idempotencyKey: buildIdempotencyKey('PAYOUT', payment.bookingId),
      notes: { tripId: meta.tripId, crashRecovery: meta.crashRecovery },
    })
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
