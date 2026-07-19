import { Logger } from 'pino'
import { startTimer } from '../utils/perf-timer'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { WebhookEventRepository } from '../repositories/webhook-event.repository'
import type { BookingRepository } from '../repositories/booking.repository'
import type { NotificationService } from './notification.service'
import { PaymentError, ValidationError } from '../errors/app-error'
import {
  CURRENCY,
  PAYMENT_TX_STATUS,
  PAYMENT_TX_TYPE,
  WEBHOOK_SOURCE,
  WEBHOOK_STATUS,
  REFERENCE_MODEL,
} from '../utils/constants'
import { BOOKING_STATUS, NOTIFICATION_TYPE, PAYMENT_PROVIDER } from '@shared/constants'
import { NORMALIZED_EVENT_TYPE } from '../types/payment.types'
import type { NormalizedWebhookEvent, PaymentProvider } from '../types/payment.types'
import type { IPaymentGateway, CreateOrderParams } from '../providers/payment/payment-gateway.interface'
import type { StoredWebhookEvent } from '../types/razorpay.types'

/**
 * Provider-neutral payment orchestrator (Facade pattern).
 *
 * Responsibilities:
 * - DB persistence via paymentTxRepo + webhookEventRepo
 * - Idempotency guards (@@unique([source, externalEventId]) on WebhookEvent)
 * - Status-transition guards (never downgrade a terminal/advanced status)
 * - Routing webhook/refund/escrow calls to the correct gateway (by tx.provider)
 *
 * Does NOT contain any provider-specific API code.
 * All gateway I/O is delegated to IPaymentGateway implementations.
 */
export class PaymentService {
  private bookingRepo: BookingRepository | null = null
  private notificationService: NotificationService | null = null

  constructor(
    /** Active gateway (new orders always use this) */
    private activeGateway: IPaymentGateway,
    /**
     * Registry of all configured gateways keyed by provider.
     * Used to route refunds / escrow releases / webhooks for in-flight transactions
     * created under a previous gateway after a PAYMENT_GATEWAY config cutover.
     */
    private gateways: Map<PaymentProvider, IPaymentGateway>,
    private paymentTxRepo: PaymentTransactionRepository,
    private webhookEventRepo: WebhookEventRepository,
    private logger: Logger,
  ) {}

  /**
   * Late-injects BookingRepository and NotificationService after construction.
   * Called from dependencies.ts once both services are available (they depend on
   * paymentService, so they cannot be constructor-injected without a cycle).
   */
  setPostConstruct(bookingRepo: BookingRepository, notificationService: NotificationService): void {
    this.bookingRepo = bookingRepo
    this.notificationService = notificationService
  }

  // ─── Gateway I/O Delegation ─────────────────────────

  /**
   * Creates a payment order via the active gateway.
   * Amount in paise. Returns a NormalizedOrder (includes provider + clientPayload).
   *
   * @throws PaymentError — gateway API failure
   * @throws ValidationError — zero/negative amount
   */
  async createOrder(params: CreateOrderParams) {
    const timer = startTimer()
    const { amountPaise, receipt } = params
    try {
      const order = await this.activeGateway.createOrder(params)
      this.logger.info(
        { orderId: order.orderId, provider: this.activeGateway.provider, durationMs: timer.elapsed() },
        'Payment order created',
      )
      return order
    } catch (error) {
      if (error instanceof PaymentError || error instanceof ValidationError) throw error
      this.logger.error({ error, amountPaise, receipt, durationMs: timer.elapsed() }, 'Order creation failed')
      throw new PaymentError('Failed to create payment order', error)
    }
  }

  /**
   * Captures a previously authorized payment.
   * Routes to the gateway identified by the payment's provider.
   *
   * @throws PaymentError — only when capture genuinely failed
   */
  async capturePayment(paymentId: string, amountPaise: number, currency = CURRENCY, provider?: PaymentProvider) {
    const gateway = this.resolveGateway(provider)
    return gateway.capturePayment(paymentId, amountPaise, currency)
  }

  /**
   * Verifies the client-side payment callback after checkout.
   * Razorpay: HMAC-SHA256(orderId|paymentId, keySecret).
   * Cashfree: server-side order-status fetch (no client HMAC).
   */
  async verifyClientCallback(input: {
    orderId: string
    paymentId?: string
    signature?: string
    provider?: PaymentProvider
  }): Promise<boolean> {
    const gateway = this.resolveGateway(input.provider)
    return gateway.verifyClientCallback(input)
  }

  /**
   * Polls gateway API for order status.
   * Returns normalized status: 'paid' on success.
   *
   * @throws PaymentError — API failure
   */
  async checkOrderStatus(orderId: string, provider?: PaymentProvider): Promise<string> {
    const gateway = this.resolveGateway(provider)
    return gateway.checkOrderStatus(orderId)
  }

  /**
   * Fetches the first authorized/captured payment ID for an order.
   */
  async fetchPaymentIdForOrder(orderId: string, provider?: PaymentProvider): Promise<string | null> {
    const gateway = this.resolveGateway(provider)
    return gateway.fetchPaymentIdForOrder(orderId)
  }

  /**
   * Resolves a bookingId from a gateway order ID via PaymentTransaction lookup.
   * Used by webhook controller to trigger booking confirmation.
   *
   * @returns bookingId or null if no matching transaction found
   */
  async resolveBookingIdFromOrder(orderId: string): Promise<string | null> {
    const paymentTx = await this.paymentTxRepo.findByGatewayOrderId(orderId)
    return paymentTx?.bookingId || null
  }

  /**
   * Initiates a refund. Routes to the gateway that created the transaction.
   *
   * @throws PaymentError — gateway API failure
   */
  async initiateRefund(paymentId: string, amountPaise: number, notes?: Record<string, unknown>, provider?: PaymentProvider) {
    const gateway = this.resolveGateway(provider)
    return gateway.initiateRefund(paymentId, amountPaise, notes)
  }

  /**
   * Fetches the transfer/split identifier for a captured payment.
   * Used to persist gatewayTransferId for later escrow release.
   */
  async fetchTransferId(paymentId: string, provider?: PaymentProvider): Promise<string | null> {
    const gateway = this.resolveGateway(provider)
    return gateway.fetchTransferId(paymentId)
  }

  /**
   * Releases the escrow hold on a transfer so funds settle to the organizer.
   *
   * @throws PaymentError — gateway API failure
   */
  async releaseTransferHold(transferId: string, provider?: PaymentProvider, ctx?: { orderId?: string; vendorAccountId?: string }): Promise<void> {
    const gateway = this.resolveGateway(provider)
    return gateway.releaseTransferHold(transferId, ctx)
  }

  /**
   * Transfers the held balance tranche to a vendor account, on demand.
   * Cashfree-only — routes to whichever gateway created the transaction; Razorpay
   * throws PaymentError('unsupported') since it has no deposit/balance split.
   *
   * @throws PaymentError — gateway API failure, or unsupported on this gateway
   */
  async transferToVendor(
    vendorId: string,
    amountPaise: number,
    ctx: { orderId: string; idempotencyKey: string; notes?: Record<string, unknown> },
    provider?: PaymentProvider,
  ): Promise<{ transferId: string; raw: unknown }> {
    const gateway = this.resolveGateway(provider)
    return gateway.transferToVendor(vendorId, amountPaise, ctx)
  }

  // ─── Webhook Handling ──────────────────────────────────

  /**
   * Verifies and records an incoming webhook event for async processing.
   * Verification and parsing are delegated to the gateway (per-provider HMAC scheme).
   * Idempotency: @@unique([source, externalEventId]) on WebhookEvent.
   *
   * @returns webhookEventId for async processing, or null if duplicate
   */
  async handleWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
    provider?: PaymentProvider,
  ): Promise<{ webhookEventId: string | null; normalized: NormalizedWebhookEvent } | null> {
    const timer = startTimer()
    const gateway = this.resolveGateway(provider)

    // Verify signature + parse in one call (throws AuthError on bad sig)
    const normalized = gateway.verifyAndParseWebhook(rawBody, headers)

    if (!normalized.externalEventId) {
      throw new ValidationError('Webhook missing deduplication key')
    }

    // Resolve booking from order for reference linking
    const paymentTx = normalized.orderId
      ? await this.paymentTxRepo.findByGatewayOrderId(normalized.orderId)
      : null

    try {
      const webhookEvent = await this.webhookEventRepo.upsertBySourceAndEventId({
        source: gateway.provider.toUpperCase() as typeof WEBHOOK_SOURCE[keyof typeof WEBHOOK_SOURCE],
        externalEventId: normalized.externalEventId,
        eventType: normalized.rawEventName,
        externalId: normalized.paymentId ?? normalized.orderId ?? null,
        referenceModel: paymentTx ? REFERENCE_MODEL.BOOKING : null,
        referenceId: paymentTx?.bookingId || null,
        headers: Object.fromEntries(
          Object.entries(headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v ?? '')] as [string, string]),
        ) as Record<string, string>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: normalized.payload as any,
        mode: normalized.mode,
        status: WEBHOOK_STATUS.RECEIVED,
      })

      if (webhookEvent.attempts > 1) {
        this.logger.info(
          { externalEventId: normalized.externalEventId, attempts: webhookEvent.attempts },
          'Duplicate webhook, skipping processing',
        )
        return { webhookEventId: null, normalized }
      }

      this.logger.info(
        { webhookEventId: webhookEvent.id, provider: gateway.provider, durationMs: timer.elapsed() },
        'Webhook event recorded',
      )
      return { webhookEventId: webhookEvent.id, normalized }
    } catch (err) {
      this.logger.error({ externalEventId: normalized.externalEventId, err }, 'Failed to record webhook event')
      throw err
    }
  }

  /**
   * Processes a recorded webhook event asynchronously.
   * Called via setImmediate() AFTER 200 response is sent.
   *
   * Status transitions: RECEIVED → PROCESSING → COMPLETED | FAILED | SKIPPED
   */
  async processWebhookEvent(webhookEvent: StoredWebhookEvent) {
    try {
      await this.webhookEventRepo.updateStatus(webhookEvent.id, WEBHOOK_STATUS.PROCESSING, undefined)

      // Re-parse normalized event from the stored payload
      const normalized = webhookEvent.payload as unknown as NormalizedWebhookEvent
      // If the stored payload is a raw gateway body rather than a NormalizedWebhookEvent,
      // we need the type field. It was stored as rawEventName-derived type in handleWebhook.
      const eventType = (webhookEvent as unknown as { normalizedType?: string }).normalizedType
        ?? normalized?.type
        ?? NORMALIZED_EVENT_TYPE.UNKNOWN

      switch (eventType) {
        case NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED:
          await this.handlePaymentAuthorized(normalized)
          break
        case NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED:
          await this.handlePaymentCaptured(normalized)
          break
        case NORMALIZED_EVENT_TYPE.ORDER_PAID:
          await this.handleOrderPaid(normalized)
          break
        case NORMALIZED_EVENT_TYPE.PAYMENT_FAILED:
          await this.handlePaymentFailed(normalized)
          break
        case NORMALIZED_EVENT_TYPE.REFUND_PROCESSED:
          await this.handleRefundProcessed(normalized)
          break
        default:
          await this.webhookEventRepo.updateStatus(webhookEvent.id, WEBHOOK_STATUS.SKIPPED, {
            failureReason: `Unhandled event type: ${eventType}`,
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

  // ─── Webhook Event Handlers ────────────────────────────

  /**
   * Handles PAYMENT_AUTHORIZED event.
   * Updates PaymentTransaction to AUTHORIZED and sets gatewayPaymentId.
   *
   * Guards against out-of-order delivery — never downgrade CAPTURED/REFUNDED.
   */
  async handlePaymentAuthorized(event: NormalizedWebhookEvent) {
    if (!event.orderId) return

    const paymentTx = await this.paymentTxRepo.findByGatewayOrderId(event.orderId)
    if (!paymentTx) {
      this.logger.warn({ orderId: event.orderId }, 'No payment transaction found for authorized payment')
      return
    }

    if (paymentTx.status === PAYMENT_TX_STATUS.CAPTURED || paymentTx.status === PAYMENT_TX_STATUS.REFUNDED) {
      this.logger.info(
        { paymentTxId: paymentTx.id, currentStatus: paymentTx.status },
        'PAYMENT_AUTHORIZED received but tx is already at a terminal/advanced status — skipping',
      )
      return
    }

    if (event.paymentId) {
      await this.paymentTxRepo.updatePaymentId(paymentTx.id, event.paymentId)
    }
    await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.AUTHORIZED)
  }

  /**
   * Handles PAYMENT_CAPTURED event.
   * Updates to CAPTURED, fires async transfer-ID fetch (fire-and-forget).
   *
   * Guards: never overwrite REFUNDED → CAPTURED (ledger corruption).
   */
  async handlePaymentCaptured(event: NormalizedWebhookEvent) {
    if (!event.orderId) return

    const paymentTx = await this.paymentTxRepo.findByGatewayOrderId(event.orderId)
    if (!paymentTx) {
      this.logger.warn({ orderId: event.orderId }, 'No payment transaction found for captured payment')
      return
    }

    if (paymentTx.status === PAYMENT_TX_STATUS.REFUNDED) {
      this.logger.info({ paymentTxId: paymentTx.id }, 'PAYMENT_CAPTURED but tx already REFUNDED — skipping')
      return
    }

    if (event.paymentId) {
      await this.paymentTxRepo.updatePaymentId(paymentTx.id, event.paymentId)
    }
    const resolvedProvider = this.resolveProviderFromTx(paymentTx)
    if (!paymentTx.provider) {
      this.logger.info({ paymentTxId: paymentTx.id, resolvedProvider }, 'Backfilling missing provider on CAPTURED tx')
    }
    await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.CAPTURED, { provider: resolvedProvider })

    // Fire-and-forget transfer ID fetch — don't block webhook response
    if (event.paymentId) {
      this.storeTransferIdAsync(paymentTx.id, event.paymentId, resolvedProvider)
    }
  }

  /**
   * Handles ORDER_PAID event — the most reliable "payment complete" signal.
   * Guards: never overwrite REFUNDED → CAPTURED.
   */
  async handleOrderPaid(event: NormalizedWebhookEvent) {
    if (!event.orderId) return

    const paymentTx = await this.paymentTxRepo.findByGatewayOrderId(event.orderId)
    if (!paymentTx) {
      this.logger.warn({ orderId: event.orderId }, 'No payment transaction found for paid order')
      return
    }

    if (paymentTx.status === PAYMENT_TX_STATUS.REFUNDED) {
      this.logger.info({ paymentTxId: paymentTx.id }, 'ORDER_PAID but tx already REFUNDED — skipping')
      return
    }

    if (event.paymentId) {
      await this.paymentTxRepo.updatePaymentId(paymentTx.id, event.paymentId)
    }
    const resolvedProvider = this.resolveProviderFromTx(paymentTx)
    if (!paymentTx.provider) {
      this.logger.info({ paymentTxId: paymentTx.id, resolvedProvider }, 'Backfilling missing provider on CAPTURED tx')
    }
    await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.CAPTURED, { provider: resolvedProvider })
  }

  /**
   * Handles PAYMENT_FAILED event.
   * Logs failure but does NOT expire booking (UPI allows retry within same session).
   *
   * Guards: never overwrite CAPTURED/REFUNDED → FAILED (stale event after successful retry).
   */
  async handlePaymentFailed(event: NormalizedWebhookEvent) {
    if (!event.orderId) return

    const paymentTx = await this.paymentTxRepo.findByGatewayOrderId(event.orderId)
    if (!paymentTx) {
      this.logger.warn({ orderId: event.orderId }, 'No payment transaction found for failed payment')
      return
    }

    if (
      paymentTx.status === PAYMENT_TX_STATUS.CAPTURED ||
      paymentTx.status === PAYMENT_TX_STATUS.REFUNDED
    ) {
      this.logger.info(
        { paymentTxId: paymentTx.id, currentStatus: paymentTx.status },
        'PAYMENT_FAILED but tx already at terminal status — skipping',
      )
      return
    }

    const failureReason = event.failureReason ?? 'Payment failed'
    await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.FAILED, { failureReason })
    this.logger.info(
      { paymentTxId: paymentTx.id, bookingId: paymentTx.bookingId, failureReason },
      'Payment failed — booking stays PENDING_PAYMENT for possible retry',
    )
  }

  /**
   * Handles REFUND_PROCESSED event.
   * Marks both the PAYMENT tx (ledger accuracy) and the REFUND tx (audit trail) as REFUNDED.
   *
   * Idempotent on duplicate delivery — PAYMENT tx already REFUNDED → skip write but close REFUND tx.
   *
   * Lookup strategy:
   * - Razorpay: event.paymentId is always present → findByGatewayPaymentId
   * - Cashfree: REFUND_STATUS_WEBHOOK may have paymentId=null (no data.payment block) →
   *   fall back to findByGatewayOrderId using event.orderId
   */
  async handleRefundProcessed(event: NormalizedWebhookEvent) {
    if (!event.paymentId && !event.orderId) return

    let paymentTx = event.paymentId
      ? await this.paymentTxRepo.findByGatewayPaymentId(event.paymentId)
      : null

    // Cashfree fallback: refund webhooks may not include data.payment — use orderId instead
    if (!paymentTx && event.orderId) {
      paymentTx = await this.paymentTxRepo.findByGatewayOrderId(event.orderId)
    }

    if (!paymentTx) {
      this.logger.warn({ paymentId: event.paymentId, orderId: event.orderId }, 'No payment transaction found for refund')
      return
    }

    if (paymentTx.status !== PAYMENT_TX_STATUS.REFUNDED) {
      await this.paymentTxRepo.updateStatus(paymentTx.id, PAYMENT_TX_STATUS.REFUNDED, {
        gatewayRefundId: event.refundId ?? undefined,
      })
    } else {
      this.logger.info(
        { paymentTxId: paymentTx.id },
        'REFUND_PROCESSED: PAYMENT tx already REFUNDED — skipping (duplicate delivery)',
      )
    }

    // Close the REFUND tx row (created in BookingService.initiateBookingRefund)
    const refundTx = await this.paymentTxRepo.findInitiatedRefundByBookingId(paymentTx.bookingId)
    if (refundTx) {
      await this.paymentTxRepo.updateStatus(refundTx.id, PAYMENT_TX_STATUS.REFUNDED, {
        gatewayRefundId: event.refundId ?? undefined,
      })
    } else {
      // Refund was triggered externally (e.g. via gateway dashboard) — create the REFUND tx
      // so it appears in the user's payment history. Guard against duplicate webhooks by
      // checking whether a REFUND tx already exists for this booking.
      const allTxs = await this.paymentTxRepo.findByBookingId(paymentTx.bookingId)
      const existingRefundTx = allTxs.find((tx) => tx.type === PAYMENT_TX_TYPE.REFUND)
      if (existingRefundTx) {
        this.logger.info(
          { bookingId: paymentTx.bookingId, refundTxId: existingRefundTx.id },
          'REFUND_PROCESSED: REFUND tx already exists (duplicate webhook or race) — skipping creation',
        )
      } else {
        this.paymentTxRepo.create({
          bookingId: paymentTx.bookingId,
          type: PAYMENT_TX_TYPE.REFUND,
          amount: paymentTx.amount,
          status: PAYMENT_TX_STATUS.REFUNDED,
          provider: paymentTx.provider ?? undefined,
          gatewayRefundId: event.refundId ?? undefined,
        })
          .then(() => this.logger.info(
            { bookingId: paymentTx.bookingId, gatewayRefundId: event.refundId },
            'REFUND_PROCESSED: created REFUND tx for externally-triggered refund',
          ))
          .catch((err) => this.logger.warn(
            { err, bookingId: paymentTx.bookingId },
            'REFUND_PROCESSED: failed to create REFUND tx (duplicate webhook race or DB error)',
          ))
      }
    }

    // Transition booking status to REFUNDED, then notify the traveler.
    // All fire-and-forget — a failure here does not invalidate the payment-transaction
    // updates already committed above. One DB call (findById) drives both the status
    // update and the notification to avoid a double round-trip.
    const bookingRepo = this.bookingRepo
    const notificationService = this.notificationService
    if (bookingRepo) {
      const refundAmount = refundTx?.amount ?? paymentTx.amount
      bookingRepo.findById(paymentTx.bookingId)
        .then((booking) => {
          if (!booking) return
          bookingRepo.updateStatus(booking.id, BOOKING_STATUS.REFUNDED)
            .catch((err) => this.logger.error({ err, bookingId: booking.id }, 'REFUND_PROCESSED: failed to update booking status to REFUNDED'))
          if (notificationService) {
            notificationService.send({
              userId: booking.userId,
              type: NOTIFICATION_TYPE.REFUND_PROCESSED,
              title: 'Refund Processed',
              body: `Your refund of ₹${refundAmount} for ${booking.trip.title} has been processed and will appear in your account within 4–5 working days.`,
              data: { bookingId: booking.id, tripId: booking.trip.id, tripSlug: booking.trip.slug, tripName: booking.trip.title, refundAmount },
            }).catch((err) => this.logger.error({ err, bookingId: booking.id }, 'REFUND_PROCESSED: failed to send refund notification'))
          }
        })
        .catch((err) => this.logger.error({ err, bookingId: paymentTx.bookingId }, 'REFUND_PROCESSED: failed to fetch booking for status update and notification'))
    }
  }

  // ─── Provider Resolution ─────────────────────────────

  /**
   * Resolves the payment provider for a transaction.
   * Single source of truth for all provider-routing decisions — used by both
   * webhook handlers (to backfill missing provider on old rows) and BookingService
   * (to route refunds correctly regardless of when the transaction was created).
   *
   * Resolution order:
   * 1. Stored `provider` field if it matches a registered gateway.
   * 2. Order ID format: Cashfree orders use our "booking-{timestamp}" receipt;
   *    Razorpay orders use the "order_" prefix.
   * 3. Default: razorpay (with warn log for ops visibility).
   */
  resolveProviderFromTx(tx: {
    provider?: string | null
    gatewayOrderId?: string | null
    razorpayOrderId?: string | null
  }): PaymentProvider {
    const stored = tx.provider as PaymentProvider | undefined
    if (stored && this.gateways.has(stored)) return stored

    const orderId = tx.gatewayOrderId ?? tx.razorpayOrderId
    if (orderId?.startsWith('booking-')) {
      if (!stored) {
        this.logger.warn({ orderId }, 'provider not set on tx — inferred cashfree from order ID format')
      }
      return PAYMENT_PROVIDER.CASHFREE as PaymentProvider
    }

    if (!stored) {
      this.logger.warn({ orderId: orderId ?? null }, 'provider not set and cannot infer from order ID — defaulting to razorpay')
    }
    return PAYMENT_PROVIDER.RAZORPAY as PaymentProvider
  }

  // ─── Private helpers ─────────────────────────────────

  /**
   * Async helper: fetches transfer ID from gateway and persists it.
   * Non-blocking — errors are logged, not thrown. Lifecycle cron is the safety net.
   */
  private storeTransferIdAsync(paymentTxId: string, paymentId: string, provider: PaymentProvider): void {
    this.fetchTransferId(paymentId, provider)
      .then((transferId) => {
        if (transferId) {
          return this.paymentTxRepo.updateStatus(paymentTxId, PAYMENT_TX_STATUS.CAPTURED, {
            gatewayTransferId: transferId,
          })
        }
        this.logger.info({ paymentTxId, paymentId }, 'No transfer found — lifecycle cron will lazy-fetch')
      })
      .catch((error) => {
        this.logger.warn({ paymentTxId, paymentId, error }, 'Async transfer ID fetch failed — lifecycle cron will retry')
      })
  }

  /**
   * Resolves the correct gateway for a given provider.
   * Falls back to the active gateway when no provider is specified (new transactions).
   */
  private resolveGateway(provider?: PaymentProvider): IPaymentGateway {
    if (!provider) return this.activeGateway
    const gateway = this.gateways.get(provider)
    if (!gateway) {
      this.logger.warn({ provider }, `No gateway registered for provider=${provider}, falling back to active gateway`)
      return this.activeGateway
    }
    return gateway
  }
}
