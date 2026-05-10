import type { Request, Response } from 'express'
import { PaymentService } from '../services/payment.service'
import { BookingService } from '../services/booking.service'
import { logger } from '../utils/logger'

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
          if (['payment.authorized', 'order.paid'].includes(body.event)) {
            const paymentEntity = body.payload?.payment?.entity
            const orderId = paymentEntity?.order_id
            if (orderId) {
              try {
                // Resolve booking via PaymentTransaction → bookingId
                const webhookEvent = await this.paymentService.resolveBookingIdFromOrder(orderId)
                if (webhookEvent) {
                  // confirmBooking is idempotent — safe to call from both FE and webhook
                  await this.bookingService.confirmBooking(webhookEvent)
                  log.info({ orderId, bookingId: webhookEvent }, 'Booking confirmed via webhook')
                }
              } catch (confirmError) {
                log.error({ confirmError, orderId }, 'Booking confirmation from webhook failed')
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
