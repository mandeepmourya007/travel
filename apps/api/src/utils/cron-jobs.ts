import { logger } from './logger'
import { BookingRepository } from '../repositories/booking.repository'
import { PaymentService } from '../services/payment.service'

/**
 * Expires stale PENDING_PAYMENT bookings that have passed their expiresAt.
 *
 * Safety net (H3 fix): Before expiring, polls Razorpay to check if payment
 * was actually completed but webhook was missed.
 *
 * Intended to be called via setInterval() or node-cron every 5 minutes.
 */
export async function expireStaleBookings(
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
