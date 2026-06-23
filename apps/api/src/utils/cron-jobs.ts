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
import { NotificationService } from '../services/notification.service'
import { NOTIFICATION_TYPE } from '@shared/constants'
import { BOOKING_STATUS } from '@shared/constants/booking-status'
import { RAZORPAY_ORDER_STATUS, WALLET_EXPIRY_WARN_DAYS } from './constants'

// ── Intervals (ms) ───────────────────────────────────
const FIVE_MINUTES = 5 * 60 * 1000
const THIRTY_MINUTES = 30 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000
const SIX_HOURS = 6 * 60 * 60 * 1000
const ONE_MINUTE = 60 * 1000
const FOURTEEN_MINUTES = 14 * 60 * 1000

// ── Lock TTLs (ms) ───────────────────────────────────
// Sized generously above worst-case job runtime. A dropped lock (volatile-lru
// eviction) is safe — the DB partial unique index is the escrow backstop.
const LOCK_TTL_1MIN = 55 * 1000          // just under 1-min interval
const LOCK_TTL_5MIN = 4 * 60 * 1000
const LOCK_TTL_30MIN = 20 * 60 * 1000
const LOCK_TTL_1HOUR = 50 * 60 * 1000
const LOCK_TTL_6HOUR = 5 * 60 * 60 * 1000

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
            if (orderStatus === RAZORPAY_ORDER_STATUS.PAID) {
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

        await bookingRepo.updateStatus(booking.id, BOOKING_STATUS.EXPIRED)
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
 * Sends TRIP_REMINDER notifications to travelers whose trip starts in the
 * next 24-48 hours and haven't received a reminder yet.
 *
 * Uses a durable dedup flag (Booking.tripReminderSentAt) so the job is safe
 * to run hourly without re-notifying travelers.
 *
 * Intended to be called via setInterval() every hour.
 */
async function sendTripReminders(
  bookingRepo: BookingRepository,
  notificationService: NotificationService,
) {
  try {
    const now = new Date()
    const from = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const to = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const bookings = await bookingRepo.findBookingsNeedingTripReminder(from, to)
    if (bookings.length === 0) return

    logger.info({ count: bookings.length }, 'Sending trip reminder notifications')

    const sentAt = new Date()
    const sentIds: string[] = []

    await Promise.allSettled(
      bookings.map(async (booking) => {
        const pickupLabel = booking.pickupPoint?.label ?? ''
        const pickupTime = booking.pickupPoint?.time ?? ''
        const pickupDetails = [pickupLabel, pickupTime].filter(Boolean).join(' @ ')
        const body = pickupDetails
          ? `"${booking.trip.title}" starts soon. Pickup: ${pickupDetails}`
          : `"${booking.trip.title}" starts soon. Check your booking for details.`

        try {
          await notificationService.send({
            userId: booking.userId,
            type: NOTIFICATION_TYPE.TRIP_REMINDER,
            title: 'Your trip is almost here!',
            body,
            data: {
              tripSlug: booking.trip.slug,
              tripName: booking.trip.title,
              pickupLabel,
              pickupTime,
            },
          })
          sentIds.push(booking.id)
        } catch (err) {
          logger.warn({ bookingId: booking.id, err }, 'Trip reminder notification failed')
        }
      }),
    )

    if (sentIds.length > 0) {
      await bookingRepo.markTripReminderSent(sentIds, sentAt)
      logger.info({ sent: sentIds.length, total: bookings.length }, 'Trip reminders sent')
    }
  } catch (error) {
    logger.error({ error }, 'Trip reminder job failed')
  }
}

/**
 * Voids expired wallet credits and sends advance-warning notifications
 * for credits expiring within WALLET_EXPIRY_WARN_DAYS.
 *
 * Runs every 6 hours — infrequent enough for a low-volume sweep.
 */
async function expireWalletCreditsAndWarn(
  walletService: WalletService,
  notificationService: NotificationService,
) {
  try {
    // 1. Void expired credits
    const { voided, skipped } = await walletService.expireCredits()
    if (voided > 0) {
      logger.info({ voided, skipped }, 'Wallet credits expired')
    }

    // 2. Send advance-warning notifications for credits approaching expiry
    const approaching = await walletService.findCreditsNeedingExpiryReminder()
    if (approaching.length === 0) return

    logger.info({ count: approaching.length }, 'Sending wallet expiry warning notifications')

    const sentAt = new Date()
    const sentIds: string[] = []

    await Promise.allSettled(
      approaching.map(async (credit) => {
        const daysLeft = credit.expiresAt
          ? Math.max(1, Math.ceil((credit.expiresAt.getTime() - sentAt.getTime()) / (86400 * 1000)))
          : WALLET_EXPIRY_WARN_DAYS

        try {
          await notificationService.send({
            userId: credit.wallet.userId,
            type: NOTIFICATION_TYPE.WALLET_CREDIT_EXPIRING,
            title: `₹${credit.amount} wallet credit expiring soon`,
            body: `Your ₹${credit.amount} wallet balance expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Book a trip to use it!`,
            data: { amount: credit.amount, daysLeft },
          })
          sentIds.push(credit.id)
        } catch (err) {
          logger.warn({ creditId: credit.id, err }, 'Wallet expiry warning notification failed')
        }
      }),
    )

    if (sentIds.length > 0) {
      await walletService.markExpiryReminderSent(sentIds, sentAt)
    }
  } catch (error) {
    logger.error({ error }, 'Wallet credit expiry job failed')
  }
}

/**
 * Pings the API's own health endpoint every 14 minutes to prevent Render free
 * tier from spinning down (Render sleeps services after 15 min of inactivity).
 * No-op in development or when PORT is not set.
 */
async function keepAlive() {
  const port = process.env.PORT
  if (!port || process.env.NODE_ENV !== 'production') return
  try {
    await fetch(`http://localhost:${port}/health`)
  } catch {
    // Ignore — if the server can't reach itself it's already awake
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
  notificationService: NotificationService
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
    setInterval(
      () => withLock('cron:trip-reminders', LOCK_TTL_1HOUR,
        () => sendTripReminders(deps.bookingRepo, deps.notificationService)),
      ONE_HOUR,
    ),
    setInterval(
      () => withLock('cron:expire-wallet-credits', LOCK_TTL_6HOUR,
        () => expireWalletCreditsAndWarn(deps.walletService, deps.notificationService)),
      SIX_HOURS,
    ),
    // Render free tier spins down after 15 min — ping ourselves every 14 min to stay awake
    setInterval(keepAlive, FOURTEEN_MINUTES),
  ]

  return () => {
    intervals.forEach(clearInterval)
    logger.info('Cron jobs stopped')
  }
}
