import crypto from 'crypto'
import type Razorpay from 'razorpay'
import { Logger } from 'pino'
import { startTimer } from '../utils/perf-timer'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { WebhookEventRepository } from '../repositories/webhook-event.repository'
import { PaymentError, ValidationError } from '../errors/app-error'
import { CURRENCY, PAYMENT_TX_STATUS, WEBHOOK_SOURCE, WEBHOOK_STATUS, REFERENCE_MODEL, RAZORPAY_WEBHOOK_EVENT } from '../utils/constants'
import type { RazorpayWebhookPayload, StoredWebhookEvent } from '../types/razorpay.types'

export class PaymentService {
  constructor(
    private razorpay: Razorpay,
    private paymentTxRepo: PaymentTransactionRepository,
    private webhookEventRepo: WebhookEventRepository,
    private keySecret: string,
    private logger: Logger,
  ) {}

  // ─── Razorpay API Wrappers ────────────────────────────

  /**
   * Creates a Razorpay order. Full amount is collected into the platform account.
   * Amount must be in PAISE (₹5000 = 500000 paise).
   *
   * ROUTE_HOOK: To add automatic SafePay splits via Razorpay Route, add a
   * `transfers` param and spread it into the order payload. See the ROUTE_HOOK
   * comment in booking.service.ts for the full transfer object shape.
   *
   * @throws PaymentError — Razorpay API failure
   * @throws ValidationError — zero/negative amount
   */
  async createOrder(
    amount: number,
    receipt: string,
    notes: Record<string, unknown>,
  ) {
    const timer = startTimer()
    if (amount <= 0) {
      throw new ValidationError('Order amount must be greater than zero')
    }

    try {
      const order = await this.razorpay.orders.create({
        amount,
        currency: CURRENCY,
        receipt,
        payment_capture: 0,
        notes,
      } as Parameters<typeof this.razorpay.orders.create>[0])
      this.logger.info({ orderId: order.id, amount, receipt, durationMs: timer.elapsed() }, 'Razorpay order created')
      return order
    } catch (error) {
      this.logger.error({ error, amount, receipt, durationMs: timer.elapsed() }, 'Razorpay order creation failed')
      throw new PaymentError('Failed to create Razorpay order', error)
    }
  }

  /**
   * Captures a previously authorized payment.
   * Amount MUST exactly match the authorized amount.
   *
   * Idempotent under all transient failures:
   *   - "already been captured" error → fetch and return existing capture
   *   - Network timeout / unknown error → verify actual Razorpay status before throwing.
   *     If the payment shows as 'captured', the capture succeeded and we return it.
   *     This prevents confirmBooking from reverting the gate on a successful capture that
   *     happened to time out from our perspective.
   *
   * @throws PaymentError — only when capture genuinely failed (Razorpay status ≠ captured)
   */
  async capturePayment(paymentId: string, amount: number, currency = CURRENCY) {
    try {
      return await this.razorpay.payments.capture(paymentId, amount, currency)
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('already been captured')) {
        this.logger.info({ paymentId }, 'Payment already captured — fetching existing')
        return await this.razorpay.payments.fetch(paymentId)
      }

      // For transient errors (timeout, network) the capture may have gone through on Razorpay's
      // side. Verify the actual status before declaring failure to avoid incorrectly reverting
      // a successful capture.
      try {
        const payment = await this.razorpay.payments.fetch(paymentId)
        if (payment?.status === 'captured') {
          this.logger.warn({ paymentId }, 'Capture threw but payment shows as captured — treating as success')
          return payment
        }
      } catch (fetchErr) {
        this.logger.error({ paymentId, fetchErr }, 'Could not verify payment status after capture error')
      }

      this.logger.error({ error, paymentId, amount }, 'Payment capture failed')
      throw new PaymentError('Failed to capture payment', error)
    }
  }

  /**
   * Verifies Razorpay payment signature using HMAC-SHA256.
   * Formula: HMAC_SHA256(orderId + "|" + paymentId, key_secret)
   */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const expectedSig = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig, 'hex'),
        Buffer.from(signature, 'hex'),
      )
    } catch {
      return false
    }
  }

  /**
   * Polls Razorpay API for order status — safety net for stuck payments (H3 fix).
   * Used by cron job before expiring bookings and admin dashboard.
   *
   * @returns Order status string: 'created' | 'attempted' | 'paid'
   * @throws PaymentError — API failure
   */
  async checkOrderStatus(orderId: string): Promise<string> {
    try {
      const order = await this.razorpay.orders.fetch(orderId)
      return (order as unknown as { status: string }).status
    } catch (error) {
      this.logger.error({ error, orderId }, 'Order status check failed')
      throw new PaymentError('Failed to check order status', error)
    }
  }

  /**
   * Initiates a refund with Route transfer reversal (H2 fix).
   * `reverse_all: 1` ensures organizer transfer is also reversed.
   *
   * @throws PaymentError — Razorpay API failure
   */
  async initiateRefund(paymentId: string, amount: number, notes?: Record<string, unknown>) {
    try {
      return await this.razorpay.payments.refund(paymentId, {
        amount,
        reverse_all: 1,
        notes,
      } as Parameters<typeof this.razorpay.payments.refund>[1])
    } catch (error) {
      this.logger.error({ error, paymentId, amount }, 'Refund initiation failed')
      throw new PaymentError('Failed to initiate refund', error)
    }
  }

  // Returns the first authorized/captured paymentId for an order, or null if the Razorpay API is unavailable.
  async fetchPaymentIdForOrder(orderId: string): Promise<string | null> {
    try {
      // SDK types don't expose orders.fetchPayments — cast through unknown
      const payments = await (this.razorpay.orders as unknown as {
        fetchPayments: (id: string) => Promise<{ items?: Array<{ id: string; status: string }> }>
      }).fetchPayments(orderId)
      const paid = payments?.items?.find(
        (p) => p.status === 'captured' || p.status === 'authorized',
      )
      return paid?.id ?? null
    } catch (error) {
      this.logger.warn({ orderId, error }, 'Failed to fetch payments for order')
      return null
    }
  }

  /**
   * Resolves a bookingId from a Razorpay order ID by looking up the PaymentTransaction.
   * Used by webhook controller to trigger booking confirmation after payment events.
   *
   * @returns bookingId or null if no matching transaction found
   */
  async resolveBookingIdFromOrder(orderId: string): Promise<string | null> {
    const paymentTx = await this.paymentTxRepo.findByRazorpayOrderId(orderId)
    return paymentTx?.bookingId || null
  }

  // ─── Webhook Handling ─────────────────────────────────

  /**
   * Records an incoming webhook event for async processing.
   * Uses `x-razorpay-event-id` header for idempotency (C1 fix).
   *
   * @returns webhookEventId for async processing, or null if duplicate
   * @throws ValidationError — missing event ID header
   */
  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<string | null> {
    const timer = startTimer()
    const eventId = headers['x-razorpay-event-id'] as string
    if (!eventId) {
      throw new ValidationError('Missing x-razorpay-event-id header')
    }

    const body = JSON.parse(rawBody.toString())
    const signature = headers['x-razorpay-signature'] as string

    // Resolve internal reference from order → booking lookup
    const paymentEntity = body.payload?.payment?.entity || body.payload?.order?.entity
    const orderId = paymentEntity?.order_id || paymentEntity?.id
    const paymentTx = orderId
      ? await this.paymentTxRepo.findByRazorpayOrderId(orderId)
      : null

    // Idempotency: attempt upsert on (source, externalEventId) unique key.
    // Using upsert instead of find-then-create eliminates the TOCTOU race:
    // concurrent duplicate deliveries both hit the DB at the same time; one
    // inserts, the other matches the unique key and updates (increments attempts).
    // No more P2002 bubble-up or generic-catch silence.
    try {
      const webhookEvent = await this.webhookEventRepo.upsertBySourceAndEventId({
        source: WEBHOOK_SOURCE.RAZORPAY,
        externalEventId: eventId,
        eventType: body.event,
        externalId: paymentEntity?.id || null,
        referenceModel: paymentTx ? REFERENCE_MODEL.BOOKING : null,
        referenceId: paymentTx?.bookingId || null,
        headers: {
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': eventId,
        },
        payload: body,
        mode: body.account_id?.startsWith('rzp_test') ? 'test' : 'live',
        status: WEBHOOK_STATUS.RECEIVED,
      })

      if (webhookEvent.attempts > 1) {
        this.logger.info({ eventId, attempts: webhookEvent.attempts }, 'Duplicate webhook, skipping processing')
        return null
      }

      this.logger.info({ webhookEventId: webhookEvent.id, durationMs: timer.elapsed() }, 'Webhook event recorded')
      return webhookEvent.id
    } catch (err) {
      this.logger.error({ eventId, err }, 'Failed to record webhook event')
      throw err
    }
  }

  /**
   * Processes a recorded webhook event asynchronously (C4 fix).
   * Called via setImmediate() AFTER 200 response to Razorpay.
   *
   * Status transitions: RECEIVED → PROCESSING → COMPLETED | FAILED | SKIPPED
   */
  async processWebhookEvent(webhookEvent: StoredWebhookEvent) {
    try {
      await this.webhookEventRepo.updateStatus(webhookEvent.id, WEBHOOK_STATUS.PROCESSING, undefined)

      // DB stores full event body — inner .payload is the actual webhook payload
      const payload: RazorpayWebhookPayload = webhookEvent.payload?.payload ?? (webhookEvent.payload as RazorpayWebhookPayload)

      switch (webhookEvent.eventType) {
        case RAZORPAY_WEBHOOK_EVENT.PAYMENT_AUTHORIZED:
          await this.handlePaymentAuthorized(payload)
          break
        case RAZORPAY_WEBHOOK_EVENT.PAYMENT_CAPTURED:
          await this.handlePaymentCaptured(payload)
          break
        case RAZORPAY_WEBHOOK_EVENT.ORDER_PAID:
          await this.handleOrderPaid(payload)
          break
        case RAZORPAY_WEBHOOK_EVENT.PAYMENT_FAILED:
          await this.handlePaymentFailed(payload)
          break
        case RAZORPAY_WEBHOOK_EVENT.REFUND_PROCESSED:
          await this.handleRefundProcessed(payload)
          break
        default:
          await this.webhookEventRepo.updateStatus(webhookEvent.id, WEBHOOK_STATUS.SKIPPED, {
            failureReason: `Unhandled event type: ${webhookEvent.eventType}`,
          })
          return
      }

      await this.webhookEventRepo.updateStatus(webhookEvent.id, WEBHOOK_STATUS.COMPLETED, {
        processedAt: new Date(),
      })
    } catch (error: unknown) {
      this.logger.error({ webhookEventId: webhookEvent.id, error }, 'Webhook processing failed')
      await this.webhookEventRepo.updateStatus(webhookEvent.id, WEBHOOK_STATUS.FAILED, {
        failureReason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // ─── Webhook Event Handlers ───────────────────────────

  /**
   * Handles payment.authorized webhook.
   * Updates PaymentTransaction to AUTHORIZED and sets razorpayPaymentId.
   *
   * Guards against out-of-order delivery — a late payment.authorized event must not
   * downgrade an already-CAPTURED transaction back to AUTHORIZED, which would corrupt
   * the payment ledger and cause the cron's "already paid" check to misfire.
   */
  async handlePaymentAuthorized(payload: RazorpayWebhookPayload) {
    const payment = payload.payment?.entity
    if (!payment) return

    const paymentTx = await this.paymentTxRepo.findByRazorpayOrderId(payment.order_id)
    if (!paymentTx) {
      this.logger.warn({ orderId: payment.order_id }, 'No payment transaction found for authorized payment')
      return
    }

    // Only advance status — never downgrade (CAPTURED must stay CAPTURED)
    if (paymentTx.status === PAYMENT_TX_STATUS.CAPTURED || paymentTx.status === PAYMENT_TX_STATUS.REFUNDED) {
      this.logger.info(
        { paymentTxId: paymentTx.id, currentStatus: paymentTx.status },
        'payment.authorized received but tx is already at a terminal/advanced status — skipping update',
      )
      return
    }

    await this.paymentTxRepo.updatePaymentId(paymentTx.id, payment.id)
    await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.AUTHORIZED)
  }

  /**
   * Handles payment.captured webhook.
   * Updates PaymentTransaction to CAPTURED immediately, then fetches transfer ID
   * asynchronously (fire-and-forget) to avoid blocking webhook response time.
   * If the async fetch fails, the lifecycle cron's lazy-fetch picks it up later.
   */
  async handlePaymentCaptured(payload: RazorpayWebhookPayload) {
    const payment = payload.payment?.entity
    if (!payment) return

    const paymentTx = await this.paymentTxRepo.findByRazorpayOrderId(payment.order_id)
    if (!paymentTx) {
      this.logger.warn({ orderId: payment.order_id }, 'No payment transaction found for captured payment')
      return
    }

    // Guard against out-of-order delivery — a late payment.captured must not
    // overwrite a REFUNDED transaction back to CAPTURED, which would corrupt the ledger.
    if (paymentTx.status === PAYMENT_TX_STATUS.REFUNDED) {
      this.logger.info(
        { paymentTxId: paymentTx.id, currentStatus: paymentTx.status },
        'payment.captured received but tx is already REFUNDED — skipping update',
      )
      return
    }

    await this.paymentTxRepo.updatePaymentId(paymentTx.id, payment.id)
    await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.CAPTURED)

    // Fire-and-forget: fetch transfer ID async — don't block webhook response
    this.storeTransferIdAsync(paymentTx.id, payment.id)
  }

  /**
   * Async helper: fetches transfer ID from Razorpay and persists it.
   * Non-blocking — errors are logged, not thrown. Lifecycle cron is the safety net.
   */
  private storeTransferIdAsync(paymentTxId: string, razorpayPaymentId: string): void {
    this.fetchTransferId(razorpayPaymentId)
      .then((transferId) => {
        if (transferId) {
          return this.paymentTxRepo.updateStatus(paymentTxId, PAYMENT_TX_STATUS.CAPTURED, { razorpayTransferId: transferId })
        }
        this.logger.info({ paymentTxId, razorpayPaymentId }, 'No transfer found — lifecycle cron will lazy-fetch')
      })
      .catch((error) => {
        this.logger.warn({ paymentTxId, razorpayPaymentId, error }, 'Async transfer ID fetch failed — lifecycle cron will retry')
      })
  }

  /**
   * Handles order.paid webhook — the most reliable "payment complete" signal (C3 fix).
   * Fires exactly once when order transitions to 'paid'.
   *
   * Guards against out-of-order delivery — a late order.paid must not overwrite a
   * REFUNDED transaction back to CAPTURED, which would corrupt the payment ledger and
   * make the booking appear unrefunded to reconciliation crons and revenue reports.
   */
  async handleOrderPaid(payload: RazorpayWebhookPayload) {
    const order = payload.order?.entity
    const payment = payload.payment?.entity
    if (!order) return

    const orderId = order.id
    const paymentTx = await this.paymentTxRepo.findByRazorpayOrderId(orderId)
    if (!paymentTx) {
      this.logger.warn({ orderId }, 'No payment transaction found for paid order')
      return
    }

    // Guard: never overwrite a REFUNDED transaction back to CAPTURED — ledger corruption.
    if (paymentTx.status === PAYMENT_TX_STATUS.REFUNDED) {
      this.logger.info(
        { paymentTxId: paymentTx.id },
        'order.paid received but tx is already REFUNDED — skipping update',
      )
      return
    }

    if (payment?.id) {
      await this.paymentTxRepo.updatePaymentId(paymentTx.id, payment.id)
    }
    await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.CAPTURED)
  }

  /**
   * Handles payment.failed webhook (C2 fix).
   * Logs the failure as PaymentTransaction(FAILED) but does NOT expire the booking.
   * UPI TPAPs allow retry within the same session.
   *
   * Guards against out-of-order delivery — a stale payment.failed must not overwrite
   * an already-CAPTURED or REFUNDED transaction. Scenario: user fails a first UPI
   * attempt, retries successfully (booking confirmed, payment CAPTURED), then the
   * delayed payment.failed event arrives. Without this guard it overwrites CAPTURED
   * → FAILED, making the orphaned-booking sweep revert the confirmed booking and
   * triggering duplicate confirmation emails.
   */
  async handlePaymentFailed(payload: RazorpayWebhookPayload) {
    const payment = payload.payment?.entity
    if (!payment) return

    const paymentTx = await this.paymentTxRepo.findByRazorpayOrderId(payment.order_id)
    if (!paymentTx) {
      this.logger.warn({ orderId: payment.order_id }, 'No payment transaction found for failed payment')
      return
    }

    // Only advance status — never overwrite a terminal/advanced status with FAILED.
    if (
      paymentTx.status === PAYMENT_TX_STATUS.CAPTURED ||
      paymentTx.status === PAYMENT_TX_STATUS.REFUNDED
    ) {
      this.logger.info(
        { paymentTxId: paymentTx.id, currentStatus: paymentTx.status },
        'payment.failed received but tx is already at a terminal status — skipping update',
      )
      return
    }

    const failureReason = payment.error_description || payment.error_code || 'Payment failed'

    await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.FAILED, { failureReason })
    this.logger.info(
      { paymentTxId: paymentTx.id, bookingId: paymentTx.bookingId, failureReason },
      'Payment failed — booking stays PENDING_PAYMENT for possible retry',
    )
  }

  // ─── SafePay Release ───────────────────────────────────

  /**
   * Releases a held transfer so funds settle to the organizer's linked account.
   * Calls Razorpay PATCH /v1/transfers/:id with on_hold: false.
   * Idempotent — if already released, Razorpay returns success.
   *
   * @throws PaymentError — Razorpay API failure
   */
  async releaseTransferHold(transferId: string): Promise<void> {
    const timer = startTimer()
    try {
      // razorpay SDK v2.9.6: transfers.edit(transferId, data)
      // Razorpay SDK doesn't type transfers.edit — cast through unknown
      const rzp = this.razorpay as unknown as { transfers: { edit: (id: string, data: { on_hold: boolean }) => Promise<void> } }
      await rzp.transfers.edit(transferId, { on_hold: false })
      this.logger.info({ transferId, durationMs: timer.elapsed() }, 'SafePay transfer hold released')
    } catch (error: unknown) {
      // Fallback: if SDK method doesn't exist, try raw API call
      if (error instanceof Error && error.message?.includes('is not a function')) {
        this.logger.warn({ transferId }, 'razorpay.transfers.edit not available, using raw API')
        await this.releaseTransferHoldRaw(transferId)
        return
      }
      this.logger.error({ error, transferId }, 'Failed to release transfer hold')
      throw new PaymentError('Failed to release SafePay transfer', error)
    }
  }

  /**
   * Fetches transfer ID for a captured payment from Razorpay.
   * Order-level transfers are auto-created by Razorpay when payment is captured.
   *
   * Razorpay SDK returns transfers in different shapes depending on version:
   *   - v2.9.x: `payment.items[0].id` (when using expand[])
   *   - alternate: `payment.transfers.items[0].id`
   *
   * Logs the raw response keys on first miss for production debugging.
   *
   * @returns transferId or null if no transfers found
   */
  async fetchTransferId(razorpayPaymentId: string): Promise<string | null> {
    try {
      // Razorpay SDK ExpandDetails enum is incomplete — doesn't include 'transfers'
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const response = await this.razorpay.payments.fetch(
        razorpayPaymentId,
        { 'expand[]': 'transfers' } as unknown as Parameters<typeof this.razorpay.payments.fetch>[1],
      )

      // SDK response type doesn't include transfer fields — extract as record
      const typed = response as unknown as Record<string, unknown>
      const items = this.extractTransferItems(typed)

      if (items.length > 0 && typeof items[0].id === 'string') {
        return items[0].id
      }

      // Diagnostic: log top-level keys so we can fix parsing if Razorpay changes shape
      this.logger.info(
        { razorpayPaymentId, responseKeys: Object.keys(typed) },
        'No transfer items found in payment response',
      )
      return null
    } catch (error) {
      this.logger.warn({ razorpayPaymentId, error }, 'Failed to fetch transfer ID — will retry during SafePay release')
      return null
    }
  }

  /**
   * Extracts transfer items array from various Razorpay response shapes.
   * Defensive — returns empty array if structure is unrecognized.
   */
  private extractTransferItems(response: Record<string, unknown>): Array<{ id: string }> {
    // Shape 1: direct items array (expand[] response)
    if (Array.isArray(response.items)) {
      return response.items as Array<{ id: string }>
    }
    // Shape 2: nested transfers.items
    const transfers = response.transfers as Record<string, unknown> | undefined
    if (transfers && Array.isArray(transfers.items)) {
      return transfers.items as Array<{ id: string }>
    }
    return []
  }

  /**
   * Raw HTTP fallback for releasing transfer hold when SDK method is unavailable.
   */
  private async releaseTransferHoldRaw(transferId: string): Promise<void> {
    const auth = Buffer.from(`${(this.razorpay as unknown as { key_id?: string }).key_id || ''}:${this.keySecret}`).toString('base64')
    const response = await fetch(`https://api.razorpay.com/v1/transfers/${transferId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ on_hold: false }),
    })
    if (!response.ok) {
      const body = await response.text()
      throw new PaymentError(`Razorpay transfer release failed: ${response.status} ${body}`)
    }
    this.logger.info({ transferId }, 'SafePay transfer hold released (raw API)')
  }

  /**
   * Handles refund.processed webhook.
   * Marks both the PAYMENT tx (for ledger accuracy) and the REFUND tx (for audit trail)
   * as REFUNDED when refund.processed fires.
   *
   * The REFUND tx (created in BookingService.initiateBookingRefund) has no razorpayPaymentId,
   * so it cannot be found via findByRazorpayPaymentId. We look it up separately by bookingId
   * to close the INITIATED → REFUNDED lifecycle correctly.
   *
   * Idempotent on duplicate delivery: if the PAYMENT tx is already REFUNDED we skip the
   * write but still attempt to close the REFUND tx in case that half was missed.
   */
  async handleRefundProcessed(payload: RazorpayWebhookPayload) {
    const refund = payload.refund?.entity
    const payment = payload.payment?.entity
    if (!refund || !payment) return

    const paymentTx = await this.paymentTxRepo.findByRazorpayPaymentId(payment.id)
    if (!paymentTx) {
      this.logger.warn({ paymentId: payment.id }, 'No payment transaction found for refund')
      return
    }

    // Guard: idempotent on duplicate delivery. PAYMENT tx already REFUNDED means the
    // first delivery completed successfully — skip the write but fall through to close
    // the REFUND tx in case it was the part that was missed.
    if (paymentTx.status !== PAYMENT_TX_STATUS.REFUNDED) {
      await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.REFUNDED, {
        razorpayRefundId: refund.id,
      })
    } else {
      this.logger.info(
        { paymentTxId: paymentTx.id },
        'refund.processed: PAYMENT tx is already REFUNDED — skipping (duplicate delivery)',
      )
    }

    // Mark the REFUND tx as REFUNDED (audit trail: this refund request is fulfilled)
    const refundTx = await this.paymentTxRepo.findInitiatedRefundByBookingId(paymentTx.bookingId)
    if (refundTx) {
      await this.paymentTxRepo.updateStatus(refundTx.id, PAYMENT_TX_STATUS.REFUNDED, {
        razorpayRefundId: refund.id,
      })
    } else {
      this.logger.warn(
        { bookingId: paymentTx.bookingId, razorpayRefundId: refund.id },
        'refund.processed: no INITIATED REFUND tx found for booking — refund was likely triggered externally',
      )
    }
  }
}
