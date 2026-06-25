import type { Request, Response } from 'express'
import { PaymentService } from '../services/payment.service'
import { BookingService } from '../services/booking.service'
import { logger } from '../utils/logger'
import { RAZORPAY_WEBHOOK_EVENT, WEBHOOK_LOG_TAG } from '../utils/constants'

/**
 * Handles incoming webhook events from payment providers.
 *
 * Key design: Responds 200 IMMEDIATELY, then processes async via setImmediate().
 * This prevents Razorpay's 5-second timeout from causing retries (C4 fix).
 *
 * Pattern: Chain of Responsibility → Strategy (event routing in PaymentService)
 */
export class WebhookController {
  constructor(
    private paymentService: PaymentService,
    private bookingService: BookingService,
  ) {}

  /** POST /api/v1/webhooks/razorpay — raw body, verified by middleware */
  handleRazorpay = async (req: Request, res: Response) => {
    // Capture request-scoped logger before setImmediate — ALS context does NOT
    // survive setImmediate boundaries reliably. Fallback to base logger for
    // webhook routes where pino-http may not have run (raw body pipeline).
    const log = req.log ?? logger

    // Respond 200 immediately to avoid Razorpay timeout
    res.status(200).json({ received: true })

    try {
      const rawBody = req.body as Buffer
      const headers = req.headers as Record<string, string | string[] | undefined>

      // Record the webhook event (idempotency check inside)
      const webhookEventId = await this.paymentService.handleWebhook(rawBody, headers)

      if (!webhookEventId) {
        log.info('Duplicate webhook event, skipping processing')
        return
      }

      // Process asynchronously after 200 response
      setImmediate(async () => {
        try {
          const body = JSON.parse(rawBody.toString())
          await this.paymentService.processWebhookEvent({
            id: webhookEventId,
            eventType: body.event,
            payload: body,
          })

          // If payment.authorized or order.paid → attempt booking confirmation
          if ([RAZORPAY_WEBHOOK_EVENT.PAYMENT_AUTHORIZED, RAZORPAY_WEBHOOK_EVENT.ORDER_PAID].includes(body.event)) {
            const paymentEntity = body.payload?.payment?.entity
            // For order.paid Razorpay includes both payment.entity and order.entity.
            // Use payment.entity.order_id first; fall back to order.entity.id in case
            // payment entity is absent (defensive — Razorpay currently always includes it).
            const orderId = paymentEntity?.order_id ?? body.payload?.order?.entity?.id
            if (orderId) {
              // Declare outside try-catch so it's available in the catch for structured logging
              let bookingId: string | null = null
              try {
                bookingId = await this.paymentService.resolveBookingIdFromOrder(orderId)
                if (bookingId) {
                  // confirmBooking is idempotent — safe to call from both FE and webhook
                  await this.bookingService.confirmBooking(bookingId)
                  log.info({ orderId, bookingId }, 'Booking confirmed via webhook')
                }
              } catch (confirmError) {
                // The webhook event is already COMPLETED (processWebhookEvent succeeded above).
                // A confirmation failure here means the booking may be stuck in PENDING_PAYMENT.
                // Recovery paths:
                //   • ValidationError("Payment not authorized yet") → next payment.authorized webhook will confirm
                //   • Other errors → expiry cron polls Razorpay and confirms or expires the booking
                // ACTION REQUIRED if booking remains PENDING_PAYMENT after expiry window:
                //   grep logs for tag=BOOKING_CONFIRM_FAILED and this orderId/bookingId.
                log.error(
                  { confirmError, orderId, bookingId, event: body.event, tag: WEBHOOK_LOG_TAG.BOOKING_CONFIRM_FAILED },
                  'Booking confirmation failed after webhook processed — booking may be stuck in PENDING_PAYMENT; check expiry cron and payment.authorized webhook',
                )
              }
            }
          }
        } catch (error) {
          log.error({ webhookEventId, error }, 'Async webhook processing failed')
        }
      })
    } catch (error) {
      // Log but don't throw — 200 already sent
      log.error({ error }, 'Webhook handling error (200 already sent)')
    }
  }
}
