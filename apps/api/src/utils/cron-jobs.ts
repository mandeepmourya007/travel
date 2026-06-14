import { logger } from './logger'
import { withLock } from './redis-lock'
import { BookingRepository } from '../repositories/booking.repository'
import { TripRequestRepository } from '../repositories/trip-request.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { VerificationCodeRepository } from '../repositories/verification-code.repository'
import { PaymentService } from '../services/payment.service'
import { TripLifecycleService } from '../services/trip-lifecycle.service'
import { VehicleService } from '../services/vehicle.service'
import { WalletService } from '../services/wallet.service'

// ── Intervals (ms) ───────────────────────────────────
const FIVE_MINUTES = 5 * 60 * 1000
const THIRTY_MINUTES = 30 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000
const ONE_MINUTE = 60 * 1000

// ── Lock TTLs (ms) ───────────────────────────────────
// Sized generously above worst-case job runtime. A dropped lock (volatile-lru
// eviction) is safe — the DB partial unique index is the escrow backstop.
const LOCK_TTL_1MIN = 55 * 1000          // just under 1-min interval
const LOCK_TTL_5MIN = 4 * 60 * 1000
const LOCK_TTL_30MIN = 20 * 60 * 1000
const LOCK_TTL_1HOUR = 50 * 60 * 1000

/**
 * Expires stale PENDING_PAYMENT bookings that have passed their expiresAt.
 *
 * Safety net (H3 fix): Before expiring, polls Razorpay to check if payment
 * was actually completed but webhook was missed.
 *
 * Intended to be called via setInterval() every 5 minutes.
 */
async function expireStaleBookings(
  bookingRepo: BookingRepository,
  paymentService: PaymentService | null,
  vehicleService: VehicleService,
) {
  try {
    const expiredBookings = await bookingRepo.findExpiredPendingBookings()

    if (expiredBookings.length === 0) return

    logger.info({ count: expiredBookings.length }, 'Processing expired bookings')

    for (const booking of expiredBookings) {
      try {
        const paymentTx = booking.paymentTransactions[0]

        // H3 fix: Poll Razorpay before expiring — payment might have succeeded
        if (paymentService && paymentTx?.razorpayOrderId) {
          try {
            const orderStatus = await paymentService.checkOrderStatus(paymentTx.razorpayOrderId)
            if (orderStatus === 'paid') {
              logger.warn(
                { bookingId: booking.id, orderId: paymentTx.razorpayOrderId },
                'Order already paid on Razorpay — skipping expiry, webhook may have been missed',
              )
              continue
            }
          } catch (error) {
            logger.warn(
              { bookingId: booking.id, error },
              'Failed to check Razorpay order status — proceeding with expiry',
            )
          }
        }

        await bookingRepo.updateStatus(booking.id, 'EXPIRED')
        logger.info({ bookingId: booking.id }, 'Booking expired')

        // Explicitly release seats — seat-hold timer may not coincide with booking expiry
        vehicleService.releaseSeats(booking.id)
          .catch((err) => logger.error({ err, bookingId: booking.id }, 'Failed to release seats on booking expiry'))
      } catch (error) {
        logger.error({ bookingId: booking.id, error }, 'Failed to expire booking')
      }
    }
  } catch (error) {
    logger.error({ error }, 'Stale booking expiry job failed')
  }
}

/**
 * Expires APPROVED trip requests whose approval window has passed.
 * Prevents travelers from paying for long-expired approvals.
 *
 * Intended to be called via setInterval() every 5 minutes.
 */
async function expireStaleRequests(tripRequestRepo: TripRequestRepository) {
  try {
    const result = await tripRequestRepo.expireApprovedRequests()
    if (result.count > 0) {
      logger.info({ count: result.count }, 'Expired stale trip requests')
    }
  } catch (error) {
    logger.error({ error }, 'Trip request expiry job failed')
  }
}

/**
 * Deletes verification codes (OTP / email) that expired more than 24h ago.
 *
 * Intended to be called via setInterval() every hour.
 */
async function cleanupExpiredCodes(verifCodeRepo: VerificationCodeRepository) {
  try {
    const result = await verifCodeRepo.deleteExpired()
    if (result.count > 0) {
      logger.info({ count: result.count }, 'Cleaned up expired verification codes')
    }
  } catch (error) {
    logger.error({ error }, 'Verification code cleanup job failed')
  }
}

/**
 * Deletes refresh tokens that expired more than 30 days ago.
 *
 * Intended to be called via setInterval() every hour.
 */
async function cleanupStaleTokens(refreshTokenRepo: RefreshTokenRepository) {
  try {
    const result = await refreshTokenRepo.deleteExpired()
    if (result.count > 0) {
      logger.info({ count: result.count }, 'Cleaned up stale refresh tokens')
    }
  } catch (error) {
    logger.error({ error }, 'Refresh token cleanup job failed')
  }
}

/**
 * Completes ACTIVE/FULL trips past their endDate and releases escrow.
 * Also performs crash-recovery sweep for previously-failed escrow releases.
 *
 * Intended to be called via setInterval() every 30 minutes.
 */
async function completeTripsAndReleaseEscrow(tripLifecycleService: TripLifecycleService) {
  try {
    await tripLifecycleService.completeEndedTrips()
    await tripLifecycleService.releaseUnreleasedEscrows()
  } catch (error) {
    logger.error({ error }, 'Trip completion / escrow release job failed')
  }
}

/**
 * Reverts CONFIRMED bookings that have no CAPTURED payment after 30 minutes.
 * These are created when the process crashes after atomicConfirmGate but before
 * capturePayment completes. Reverting to PENDING_PAYMENT lets the expiry cron or
 * a webhook retry resolve them normally.
 *
 * Intended to be called via setInterval() every 30 minutes.
 */
async function sweepOrphanedConfirmedBookings(bookingRepo: BookingRepository) {
  try {
    const orphans = await bookingRepo.findOrphanedConfirmedBookings(30)
    if (orphans.length === 0) return

    logger.warn({ count: orphans.length }, 'Sweeping orphaned CONFIRMED bookings (no captured payment)')
    for (const booking of orphans) {
      try {
        await bookingRepo.revertConfirmGate(booking.id)
        logger.info({ bookingId: booking.id }, 'Orphaned CONFIRMED booking reverted to PENDING_PAYMENT')
      } catch (err) {
        logger.error({ err, bookingId: booking.id }, 'Failed to revert orphaned CONFIRMED booking')
      }
    }
  } catch (error) {
    logger.error({ error }, 'Orphaned confirmed booking sweep failed')
  }
}

/**
 * Expires HELD seats whose hold window has passed.
 * Runs every minute to keep seat availability fresh.
 */
async function expireHeldSeats(vehicleService: VehicleService) {
  try {
    const count = await vehicleService.expireHeldSeats()
    if (count > 0) {
      logger.info({ count }, 'Expired held seats')
    }
  } catch (error) {
    logger.error({ error }, 'Seat hold expiry job failed')
  }
}

/**
 * Reconciles wallet.balance against the computed SUM(credits) - SUM(debits).
 * Logs any drift for ops investigation — does NOT auto-fix.
 *
 * Intended to be called via setInterval() every hour.
 */
async function reconcileWallets(walletService: WalletService) {
  try {
    const { checked, drifted } = await walletService.reconcile()
    if (drifted > 0) {
      logger.error({ checked, drifted }, 'Wallet reconciliation found drift — manual investigation required')
    } else {
      logger.info({ checked }, 'Wallet reconciliation: no drift found')
    }
  } catch (error) {
    logger.error({ error }, 'Wallet reconciliation job failed')
  }
}

/**
 * Registers all recurring background jobs. Call once at server startup.
 * Returns a cleanup function that clears all intervals (for graceful shutdown).
 *
 * Every job acquires a short-lived Redis distributed lock before running so
 * that only one instance executes each job when the API is scaled horizontally.
 * When Redis is unavailable (dev / CI), withLock falls back to running the job
 * directly — single-instance behaviour is unchanged.
 */
export function startCronJobs(deps: {
  bookingRepo: BookingRepository
  tripRequestRepo: TripRequestRepository
  refreshTokenRepo: RefreshTokenRepository
  verifCodeRepo: VerificationCodeRepository
  paymentService: PaymentService | null
  tripLifecycleService: TripLifecycleService
  vehicleService: VehicleService
  walletService: WalletService
}): () => void {
  logger.info('Starting background cron jobs')

  const intervals = [
    setInterval(
      () => withLock('cron:expire-stale-bookings', LOCK_TTL_5MIN,
        () => expireStaleBookings(deps.bookingRepo, deps.paymentService, deps.vehicleService)),
      FIVE_MINUTES,
    ),
    setInterval(
      () => withLock('cron:expire-stale-requests', LOCK_TTL_5MIN,
        () => expireStaleRequests(deps.tripRequestRepo)),
      FIVE_MINUTES,
    ),
    setInterval(
      () => withLock('cron:sweep-orphaned-bookings', LOCK_TTL_30MIN,
        () => sweepOrphanedConfirmedBookings(deps.bookingRepo)),
      THIRTY_MINUTES,
    ),
    setInterval(
      () => withLock('cron:cleanup-expired-codes', LOCK_TTL_1HOUR,
        () => cleanupExpiredCodes(deps.verifCodeRepo)),
      ONE_HOUR,
    ),
    setInterval(
      () => withLock('cron:cleanup-stale-tokens', LOCK_TTL_1HOUR,
        () => cleanupStaleTokens(deps.refreshTokenRepo)),
      ONE_HOUR,
    ),
    setInterval(
      () => withLock('cron:complete-trips-escrow', LOCK_TTL_30MIN,
        () => completeTripsAndReleaseEscrow(deps.tripLifecycleService)),
      THIRTY_MINUTES,
    ),
    setInterval(
      () => withLock('cron:expire-held-seats', LOCK_TTL_1MIN,
        () => expireHeldSeats(deps.vehicleService)),
      ONE_MINUTE,
    ),
    setInterval(
      () => withLock('cron:reconcile-wallets', LOCK_TTL_1HOUR,
        () => reconcileWallets(deps.walletService)),
      ONE_HOUR,
    ),
  ]

  return () => {
    intervals.forEach(clearInterval)
    logger.info('Cron jobs stopped')
  }
}
