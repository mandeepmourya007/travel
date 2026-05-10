import { logger } from './logger'
import { BookingRepository } from '../repositories/booking.repository'
import { TripRequestRepository } from '../repositories/trip-request.repository'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository'
import { VerificationCodeRepository } from '../repositories/verification-code.repository'
import { PaymentService } from '../services/payment.service'
import { TripLifecycleService } from '../services/trip-lifecycle.service'
import { VehicleService } from '../services/vehicle.service'

// ── Intervals (ms) ───────────────────────────────────
const FIVE_MINUTES = 5 * 60 * 1000
const THIRTY_MINUTES = 30 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000
const ONE_MINUTE = 60 * 1000

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
 * Registers all recurring background jobs. Call once at server startup.
 * Returns a cleanup function that clears all intervals (for graceful shutdown).
 */
export function startCronJobs(deps: {
  bookingRepo: BookingRepository
  tripRequestRepo: TripRequestRepository
  refreshTokenRepo: RefreshTokenRepository
  verifCodeRepo: VerificationCodeRepository
  paymentService: PaymentService | null
  tripLifecycleService: TripLifecycleService
  vehicleService: VehicleService
}): () => void {
  logger.info('Starting background cron jobs')

  const intervals = [
    setInterval(() => expireStaleBookings(deps.bookingRepo, deps.paymentService), FIVE_MINUTES),
    setInterval(() => expireStaleRequests(deps.tripRequestRepo), FIVE_MINUTES),
    setInterval(() => cleanupExpiredCodes(deps.verifCodeRepo), ONE_HOUR),
    setInterval(() => cleanupStaleTokens(deps.refreshTokenRepo), ONE_HOUR),
    setInterval(() => completeTripsAndReleaseEscrow(deps.tripLifecycleService), THIRTY_MINUTES),
    setInterval(() => expireHeldSeats(deps.vehicleService), ONE_MINUTE),
  ]

  return () => {
    intervals.forEach(clearInterval)
    logger.info('Cron jobs stopped')
  }
}
