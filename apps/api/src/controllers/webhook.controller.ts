import type { Request, Response } from 'express'
import { PaymentService } from '../services/payment.service'
import { BookingService } from '../services/booking.service'
import { logger } from '../utils/logger'
import { NORMALIZED_EVENT_TYPE, WEBHOOK_LOG_TAG } from '../utils/constants'
import type { PaymentProvider } from '../types/payment.types'

/**
 * Handles incoming webhook events from payment providers (Razorpay and Cashfree).
 *
 * Key design: Responds 200 IMMEDIATELY, then processes async via setImmediate().
 * This prevents provider timeout (5s Razorpay / 30s Cashfree) from causing retries.
 *
 * Pattern: Chain of Responsibility → Strategy (event routing in PaymentService)
 */
export class WebhookController {
  constructor(
    private paymentService: PaymentService,
    private bookingService: BookingService,
  ) {}

  /** POST /api/v1/webhooks/razorpay — raw body, verified inside RazorpayGateway */
  handleRazorpay = async (req: Request, res: Response) => {
    return this.handleWebhookRequest(req, res, 'razorpay')
  }

  /** POST /api/v1/webhooks/cashfree — raw body, verified inside CashfreeGateway */
  handleCashfree = async (req: Request, res: Response) => {
    return this.handleWebhookRequest(req, res, 'cashfree')
  }

  private handleWebhookRequest = async (req: Request, res: Response, provider: PaymentProvider) => {
    const log = req.log ?? logger

    // Respond 200 immediately to avoid provider timeout
    res.status(200).json({ received: true })

    try {
      const rawBody = req.body as Buffer
      const headers = req.headers as Record<string, string | string[] | undefined>

      // Verify signature + record event (idempotency check inside)
      const result = await this.paymentService.handleWebhook(rawBody, headers, provider)

      if (!result || !result.webhookEventId) {
        log.info({ provider }, 'Duplicate webhook event, skipping processing')
        return
      }

      const { webhookEventId, normalized } = result

      // Process asynchronously after 200 response
      setImmediate(async () => {
        try {
          await this.paymentService.processWebhookEvent({
            id: webhookEventId,
            eventType: normalized.rawEventName,
            normalizedType: normalized.type,
            payload: normalized.payload,
          })

          // If authorized or paid → attempt booking confirmation
          if (
            normalized.type === NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED ||
            normalized.type === NORMALIZED_EVENT_TYPE.ORDER_PAID
          ) {
            const orderId = normalized.orderId
            if (orderId) {
              let bookingId: string | null = null
              try {
                bookingId = await this.paymentService.resolveBookingIdFromOrder(orderId)
                if (bookingId) {
                  await this.bookingService.confirmBooking(bookingId)
                  log.info({ orderId, bookingId, provider }, 'Booking confirmed via webhook')
                }
              } catch (confirmError) {
                log.error(
                  { confirmError, orderId, bookingId, event: normalized.rawEventName, provider, tag: WEBHOOK_LOG_TAG.BOOKING_CONFIRM_FAILED },
                  'Booking confirmation failed after webhook processed — booking may be stuck in PENDING_PAYMENT; check expiry cron',
                )
              }
            }
          }
        } catch (error) {
          log.error({ webhookEventId, provider, error }, 'Async webhook processing failed')
        }
      })
    } catch (error) {
      // Log but don't throw — 200 already sent
      log.error({ provider, error }, 'Webhook handling error (200 already sent)')
    }
  }
}
