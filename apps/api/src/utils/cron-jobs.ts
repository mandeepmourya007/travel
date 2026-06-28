import * as Sentry from '@sentry/node'
import { logger } from './logger'
import { withLock } from './redis-lock'
import { BookingRepository } from '../repositories/booking.repository'
import { TripRequestRepository } from '../repositories/trip-request.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { VerificationCodeRepository } from '../repositories/verification-code.repository'
import { WebhookEventRepository } from '../repositories/webhook-event.repository'
import { PaymentService } from '../services/payment.service'
import { BookingService } from '../services/booking.service'
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
const ONE_DAY = 24 * 60 * 60 * 1000

// Terminal (COMPLETED/SKIPPED) webhook events older than this are purged.
const WEBHOOK_EVENT_RETENTION_DAYS = 90

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
  bookingService: BookingService | null,
) {
  await Sentry.withMonitor('cron-expire-stale-bookings', async () => {
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
                  'Order already paid on Razorpay — attempting booking recovery (webhook may have been missed)',
                )
                if (bookingService) {
                  try {
                    await bookingService.recoverPaidBooking(booking.id)
                  } catch (recoverErr) {
                    logger.error({ recoverErr, bookingId: booking.id }, 'Booking recovery failed — booking remains PENDING_PAYMENT')
                  }
                }
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
      throw error
    }
  }, { schedule: { type: 'interval', value: 5, unit: 'minute' }, checkinMargin: 2, maxRuntime: 4 })
}

/**
 * Expires APPROVED trip requests whose approval window has passed.
 * Prevents travelers from paying for long-expired approvals.
 *
 * Intended to be called via setInterval() every 5 minutes.
 */
async function expireStaleRequests(tripRequestRepo: TripRequestRepository) {
  await Sentry.withMonitor('cron-expire-stale-requests', async () => {
    try {
      const result = await tripRequestRepo.expireApprovedRequests()
      if (result.count > 0) {
        logger.info({ count: result.count }, 'Expired stale trip requests')
      }
    } catch (error) {
      logger.error({ error }, 'Trip request expiry job failed')
      throw error
    }
  }, { schedule: { type: 'interval', value: 5, unit: 'minute' }, checkinMargin: 2, maxRuntime: 4 })
}

/**
 * Deletes verification codes (OTP / email) that expired more than 24h ago.
 *
 * Intended to be called via setInterval() every hour.
 */
async function cleanupExpiredCodes(verifCodeRepo: VerificationCodeRepository) {
  await Sentry.withMonitor('cron-cleanup-expired-codes', async () => {
    try {
      const result = await verifCodeRepo.deleteExpired()
      if (result.count > 0) {
        logger.info({ count: result.count }, 'Cleaned up expired verification codes')
      }
    } catch (error) {
      logger.error({ error }, 'Verification code cleanup job failed')
      throw error
    }
  }, { schedule: { type: 'interval', value: 1, unit: 'hour' }, checkinMargin: 5, maxRuntime: 10 })
}

/**
 * Deletes refresh tokens that expired more than 30 days ago.
 *
 * Intended to be called via setInterval() every hour.
 */
async function cleanupStaleTokens(refreshTokenRepo: RefreshTokenRepository) {
  await Sentry.withMonitor('cron-cleanup-stale-tokens', async () => {
    try {
      const result = await refreshTokenRepo.deleteExpired()
      if (result.count > 0) {
        logger.info({ count: result.count }, 'Cleaned up stale refresh tokens')
      }
    } catch (error) {
      logger.error({ error }, 'Refresh token cleanup job failed')
      throw error
    }
  }, { schedule: { type: 'interval', value: 1, unit: 'hour' }, checkinMargin: 5, maxRuntime: 10 })
}

/**
 * Purges terminal (COMPLETED/SKIPPED) webhook events older than the retention
 * window. WebhookEvent is an append-only audit table with no soft-delete, so
 * without this it grows unbounded. FAILED/unprocessed rows are kept for debugging.
 *
 * Intended to be called via setInterval() once a day.
 */
async function cleanupOldWebhookEvents(webhookEventRepo: WebhookEventRepository) {
  await Sentry.withMonitor('cron-cleanup-webhook-events', async () => {
    try {
      const cutoff = new Date(Date.now() - WEBHOOK_EVENT_RETENTION_DAYS * ONE_DAY)
      const count = await webhookEventRepo.deleteOldTerminalEvents(cutoff)
      if (count > 0) {
        logger.info({ count, retentionDays: WEBHOOK_EVENT_RETENTION_DAYS }, 'Purged old webhook events')
      }
    } catch (error) {
      logger.error({ error }, 'Webhook event retention job failed')
      throw error
    }
  }, { schedule: { type: 'interval', value: 24, unit: 'hour' }, checkinMargin: 30, maxRuntime: 30 })
}

/**
 * Completes ACTIVE/FULL trips past their endDate and releases escrow.
 * Also performs crash-recovery sweep for previously-failed escrow releases.
 *
 * Intended to be called via setInterval() every 30 minutes.
 */
async function completeTripsAndReleaseEscrow(tripLifecycleService: TripLifecycleService) {
  await Sentry.withMonitor('cron-complete-trips-escrow', async () => {
    try {
      await tripLifecycleService.completeEndedTrips()
      await tripLifecycleService.releaseUnreleasedEscrows()
    } catch (error) {
      logger.error({ error }, 'Trip completion / escrow release job failed')
      throw error
    }
  }, { schedule: { type: 'interval', value: 30, unit: 'minute' }, checkinMargin: 5, maxRuntime: 20 })
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
  await Sentry.withMonitor('cron-sweep-orphaned-bookings', async () => {
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
      throw error
    }
  }, { schedule: { type: 'interval', value: 30, unit: 'minute' }, checkinMargin: 5, maxRuntime: 20 })
}

/**
 * Expires HELD seats whose hold window has passed.
 * Runs every minute to keep seat availability fresh.
 */
async function expireHeldSeats(vehicleService: VehicleService) {
  await Sentry.withMonitor('cron-expire-held-seats', async () => {
    try {
      const count = await vehicleService.expireHeldSeats()
      if (count > 0) {
        logger.info({ count }, 'Expired held seats')
      }
    } catch (error) {
      logger.error({ error }, 'Seat hold expiry job failed')
      throw error
    }
  }, { schedule: { type: 'interval', value: 1, unit: 'minute' }, checkinMargin: 2, maxRuntime: 1 })
}

/**
 * Reconciles wallet.balance against the computed SUM(credits) - SUM(debits).
 * Logs any drift for ops investigation — does NOT auto-fix.
 *
 * Intended to be called via setInterval() every hour.
 */
async function reconcileWallets(walletService: WalletService) {
  await Sentry.withMonitor('cron-reconcile-wallets', async () => {
    try {
      const { checked, drifted } = await walletService.reconcile()
      if (drifted > 0) {
        logger.error({ checked, drifted }, 'Wallet reconciliation found drift — manual investigation required')
      } else {
        logger.info({ checked }, 'Wallet reconciliation: no drift found')
      }
    } catch (error) {
      logger.error({ error }, 'Wallet reconciliation job failed')
      throw error
    }
  }, { schedule: { type: 'interval', value: 1, unit: 'hour' }, checkinMargin: 5, maxRuntime: 30 })
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
  await Sentry.withMonitor('cron-send-trip-reminders', async () => {
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
      throw error
    }
  }, { schedule: { type: 'interval', value: 1, unit: 'hour' }, checkinMargin: 5, maxRuntime: 15 })
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
  await Sentry.withMonitor('cron-expire-wallet-credits', async () => {
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
      throw error
    }
  }, { schedule: { type: 'interval', value: 6, unit: 'hour' }, checkinMargin: 10, maxRuntime: 30 })
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
  webhookEventRepo: WebhookEventRepository
  paymentService: PaymentService | null
  bookingService: BookingService | null
  tripLifecycleService: TripLifecycleService
  vehicleService: VehicleService
  walletService: WalletService
  notificationService: NotificationService
}): () => void {
  logger.info('Starting background cron jobs')

  // withLock propagates errors from the job callback (via its try/finally).
  // setInterval doesn't await Promises, so without .catch() a failing job would
  // produce an unhandled promise rejection — crashing the process in Node 15+.
  // The jobs themselves throw (so Sentry marks the check-in as failed); we catch
  // at this level only to prevent the rejection from escaping the event loop.
  const guard = (key: string, p: Promise<unknown>) =>
    p.catch((err) => logger.error({ err }, `${key} threw an unhandled error`))

  const intervals = [
    setInterval(
      () => guard('cron:expire-stale-bookings', withLock('cron:expire-stale-bookings', LOCK_TTL_5MIN,
        () => expireStaleBookings(deps.bookingRepo, deps.paymentService, deps.vehicleService, deps.bookingService))),
      FIVE_MINUTES,
    ),
    setInterval(
      () => guard('cron:expire-stale-requests', withLock('cron:expire-stale-requests', LOCK_TTL_5MIN,
        () => expireStaleRequests(deps.tripRequestRepo))),
      FIVE_MINUTES,
    ),
    setInterval(
      () => guard('cron:sweep-orphaned-bookings', withLock('cron:sweep-orphaned-bookings', LOCK_TTL_30MIN,
        () => sweepOrphanedConfirmedBookings(deps.bookingRepo))),
      THIRTY_MINUTES,
    ),
    setInterval(
      () => guard('cron:cleanup-expired-codes', withLock('cron:cleanup-expired-codes', LOCK_TTL_1HOUR,
        () => cleanupExpiredCodes(deps.verifCodeRepo))),
      ONE_HOUR,
    ),
    setInterval(
      () => guard('cron:cleanup-stale-tokens', withLock('cron:cleanup-stale-tokens', LOCK_TTL_1HOUR,
        () => cleanupStaleTokens(deps.refreshTokenRepo))),
      ONE_HOUR,
    ),
    setInterval(
      () => guard('cron:cleanup-webhook-events', withLock('cron:cleanup-webhook-events', LOCK_TTL_6HOUR,
        () => cleanupOldWebhookEvents(deps.webhookEventRepo))),
      ONE_DAY,
    ),
    setInterval(
      () => guard('cron:complete-trips-escrow', withLock('cron:complete-trips-escrow', LOCK_TTL_30MIN,
        () => completeTripsAndReleaseEscrow(deps.tripLifecycleService))),
      THIRTY_MINUTES,
    ),
    setInterval(
      () => guard('cron:expire-held-seats', withLock('cron:expire-held-seats', LOCK_TTL_1MIN,
        () => expireHeldSeats(deps.vehicleService))),
      ONE_MINUTE,
    ),
    setInterval(
      () => guard('cron:reconcile-wallets', withLock('cron:reconcile-wallets', LOCK_TTL_1HOUR,
        () => reconcileWallets(deps.walletService))),
      ONE_HOUR,
    ),
    setInterval(
      () => guard('cron:trip-reminders', withLock('cron:trip-reminders', LOCK_TTL_1HOUR,
        () => sendTripReminders(deps.bookingRepo, deps.notificationService))),
      ONE_HOUR,
    ),
    setInterval(
      () => guard('cron:expire-wallet-credits', withLock('cron:expire-wallet-credits', LOCK_TTL_6HOUR,
        () => expireWalletCreditsAndWarn(deps.walletService, deps.notificationService))),
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
