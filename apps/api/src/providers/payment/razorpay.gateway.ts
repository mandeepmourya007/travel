import crypto from 'crypto'
import type Razorpay from 'razorpay'
import type { Logger } from 'pino'
import { AuthError, PaymentError, ValidationError } from '../../errors/app-error'
import { CURRENCY } from '../../utils/constants'
import type { RazorpayWebhookPayload } from '../../types/razorpay.types'
import { NORMALIZED_EVENT_TYPE } from '../../types/payment.types'
import type {
  IPaymentGateway,
  CreateOrderParams,
  NormalizedOrder,
  NormalizedPayment,
  NormalizedWebhookEvent,
  ClientCallbackInput,
} from './payment-gateway.interface'
import { startTimer } from '../../utils/perf-timer'

/**
 * Adapter: wraps the Razorpay SDK into the provider-neutral IPaymentGateway contract.
 *
 * Responsibilities:
 * - All Razorpay SDK calls (orders, payments, refunds, transfers)
 * - Razorpay-specific HMAC schemes (client callback: hex HMAC, webhook: hex HMAC)
 * - Mapping Razorpay response shapes to NormalizedOrder / NormalizedPayment / NormalizedWebhookEvent
 *
 * Does NOT touch the DB. All persistence lives in PaymentService (the orchestrator).
 */
export class RazorpayGateway implements IPaymentGateway {
  readonly provider = 'razorpay' as const

  constructor(
    private razorpay: Razorpay,
    private keySecret: string,
    private webhookSecret: string,
    private keyId: string,
    private logger: Logger,
  ) {}

  /**
   * Creates a Razorpay order. Amount in paise.
   * Optional split.vendorAccountId wires a Route transfer (ROUTE_HOOK).
   *
   * Business rules:
   * - payment_capture: 0 → deferred capture (manual capture after webhook confirmation)
   * - Transfers are on_hold until trip completion (SafePay pattern)
   *
   * @throws ValidationError — zero/negative amount
   * @throws PaymentError — Razorpay API failure
   */
  async createOrder(params: CreateOrderParams): Promise<NormalizedOrder> {
    const timer = startTimer()
    const { amountPaise, receipt, notes, split } = params

    if (amountPaise <= 0) {
      throw new ValidationError('Order amount must be greater than zero')
    }

    try {
      const orderPayload: Record<string, unknown> = {
        amount: amountPaise,
        currency: CURRENCY,
        receipt,
        payment_capture: 0,
        notes,
      }

      // ROUTE_HOOK: Wire split transfer if organizer has a linked Razorpay account
      if (split?.vendorAccountId) {
        orderPayload.transfers = [
          {
            account: split.vendorAccountId,
            amount: split.vendorAmountPaise,
            currency: CURRENCY,
            on_hold: 1,
            on_hold_until: split.holdUntilEpochSec,
            notes: split.notes ?? {},
          },
        ]
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const order = await this.razorpay.orders.create(orderPayload as any)

      this.logger.info(
        { orderId: order.id, amountPaise, receipt, durationMs: timer.elapsed() },
        'Razorpay order created',
      )

      return {
        orderId: order.id,
        status: (order as unknown as { status: string }).status ?? 'created',
        clientPayload: {
          provider: 'razorpay',
          orderId: order.id,
          razorpayKeyId: this.keyId,
        },
        raw: order,
      }
    } catch (error) {
      this.logger.error(
        { error, amountPaise, receipt, durationMs: timer.elapsed() },
        'Razorpay order creation failed',
      )
      throw new PaymentError('Failed to create Razorpay order', error)
    }
  }

  /**
   * Captures a previously authorized Razorpay payment.
   *
   * Idempotent:
   * - "already been captured" → fetch and return existing
   * - Network timeout with ambiguous result → verify status before throwing
   *
   * @throws PaymentError — genuine capture failure
   */
  async capturePayment(paymentId: string, amountPaise: number, currency = CURRENCY): Promise<NormalizedPayment> {
    try {
      const payment = await this.razorpay.payments.capture(paymentId, amountPaise, currency)
      return this.normalizePayment(payment)
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('already been captured')) {
        this.logger.info({ paymentId }, 'Payment already captured — fetching existing')
        const payment = await this.razorpay.payments.fetch(paymentId)
        return this.normalizePayment(payment)
      }

      // Transient error — verify actual Razorpay status before failing
      try {
        const payment = await this.razorpay.payments.fetch(paymentId)
        const p = payment as unknown as { status: string }
        if (p.status === 'captured') {
          this.logger.warn({ paymentId }, 'Capture threw but payment shows captured — treating as success')
          return this.normalizePayment(payment)
        }
      } catch (fetchErr) {
        this.logger.error({ paymentId, fetchErr }, 'Could not verify payment status after capture error')
      }

      this.logger.error({ error, paymentId, amountPaise }, 'Payment capture failed')
      throw new PaymentError('Failed to capture payment', error)
    }
  }

  /**
   * Verifies the Razorpay client-side payment callback.
   * Formula: HMAC-SHA256(orderId + "|" + paymentId, keySecret) → hex
   */
  verifyClientCallback(input: ClientCallbackInput): boolean {
    const { orderId, paymentId = '', signature = '' } = input
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
   * Polls Razorpay for order status.
   * Returns normalized status: 'created' | 'attempted' | 'paid'.
   *
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
   * Fetches the first authorized/captured payment ID for an order.
   * Uses the undocumented orders.fetchPayments endpoint.
   *
   * Edge cases:
   * - Razorpay API unavailable → returns null (cron retries)
   * - No payments yet → returns null
   */
  async fetchPaymentIdForOrder(orderId: string): Promise<string | null> {
    try {
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
   * Initiates a Razorpay refund with Route transfer reversal.
   * reverse_all: 1 ensures the organizer's Route transfer is reversed too.
   *
   * @throws PaymentError — Razorpay API failure
   */
  async initiateRefund(
    paymentId: string,
    amountPaise: number,
    notes?: Record<string, unknown>,
  ): Promise<{ refundId: string; raw: unknown }> {
    try {
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amountPaise,
        reverse_all: 1,
        notes,
      } as Parameters<typeof this.razorpay.payments.refund>[1])

      return {
        refundId: (refund as unknown as { id: string }).id,
        raw: refund,
      }
    } catch (error) {
      this.logger.error({ error, paymentId, amountPaise }, 'Refund initiation failed')
      throw new PaymentError('Failed to initiate refund', error)
    }
  }

  /**
   * Fetches the Route transfer ID for a captured Razorpay payment.
   * Used to persist gatewayTransferId for later escrow release.
   *
   * Handles two Razorpay SDK response shapes:
   * - Shape 1: response.items[] (expand[] response)
   * - Shape 2: response.transfers.items[]
   *
   * Edge cases:
   * - Transfer not yet created → null (lifecycle cron retries)
   * - API unavailable → null
   */
  async fetchTransferId(paymentId: string): Promise<string | null> {
    try {
      const response = await this.razorpay.payments.fetch(
        paymentId,
        { 'expand[]': 'transfers' } as unknown as Parameters<typeof this.razorpay.payments.fetch>[1],
      )

      const typed = response as unknown as Record<string, unknown>
      const items = this.extractTransferItems(typed)

      if (items.length > 0 && typeof items[0].id === 'string') {
        return items[0].id
      }

      this.logger.info(
        { paymentId, responseKeys: Object.keys(typed) },
        'No transfer items found in Razorpay payment response',
      )
      return null
    } catch (error) {
      this.logger.warn({ paymentId, error }, 'Failed to fetch Razorpay transfer ID')
      return null
    }
  }

  /**
   * Releases the Razorpay Route transfer hold so funds settle to the organizer.
   * Calls PATCH /v1/transfers/:id { on_hold: false }. Idempotent.
   *
   * @throws PaymentError — API failure
   */
  async releaseTransferHold(transferId: string): Promise<void> {
    const timer = startTimer()
    try {
      const rzp = this.razorpay as unknown as {
        transfers: { edit: (id: string, data: { on_hold: boolean }) => Promise<void> }
      }
      await rzp.transfers.edit(transferId, { on_hold: false })
      this.logger.info({ transferId, durationMs: timer.elapsed() }, 'Razorpay SafePay transfer hold released')
    } catch (error: unknown) {
      // SDK method missing in older versions → raw API fallback
      if (error instanceof Error && error.message?.includes('is not a function')) {
        this.logger.warn({ transferId }, 'razorpay.transfers.edit not available, using raw API')
        await this.releaseTransferHoldRaw(transferId)
        return
      }
      this.logger.error({ error, transferId }, 'Failed to release Razorpay transfer hold')
      throw new PaymentError('Failed to release SafePay transfer', error)
    }
  }

  /**
   * Verifies the Razorpay webhook HMAC-SHA256 signature, then parses and normalizes the event.
   *
   * Scheme: HMAC-SHA256(rawBody, webhookSecret) → hex → compare x-razorpay-signature.
   * Idempotency key: x-razorpay-event-id header.
   *
   * @throws AuthError — invalid/missing signature
   */
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedWebhookEvent {
    const signature = headers['x-razorpay-signature'] as string | undefined
    if (!signature) {
      throw new AuthError('Missing x-razorpay-signature header')
    }

    const expectedSig = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex')

    let isValid = false
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSig, 'hex'),
        Buffer.from(signature, 'hex'),
      )
    } catch {
      isValid = false
    }

    if (!isValid) {
      throw new AuthError('Invalid Razorpay webhook signature')
    }

    const body = JSON.parse(rawBody.toString()) as {
      event?: string
      account_id?: string
      payload?: RazorpayWebhookPayload
      [key: string]: unknown
    }

    const eventName = body.event ?? ''
    const payload = body.payload ?? {}
    const paymentEntity = payload.payment?.entity
    const orderEntity = payload.order?.entity
    const refundEntity = payload.refund?.entity

    const orderId = paymentEntity?.order_id ?? orderEntity?.id ?? null
    const paymentId = paymentEntity?.id ?? null
    const refundId = refundEntity?.id ?? null
    const externalEventId = (headers['x-razorpay-event-id'] as string | undefined) ?? `rzp_${eventName}_${orderId}`
    const mode = body.account_id?.startsWith('rzp_test') ? 'test' : 'live'
    const failureReason = paymentEntity?.error_description ?? paymentEntity?.error_code ?? null

    return {
      type: this.normalizeEventType(eventName),
      externalEventId,
      orderId,
      paymentId,
      refundId,
      failureReason,
      mode,
      rawEventName: eventName,
      payload: body,
    }
  }

  // ─── Private helpers ───────────────────────────────────

  private normalizePayment(payment: unknown): NormalizedPayment {
    const p = payment as { id?: string; status?: string }
    return {
      paymentId: p.id ?? '',
      status: p.status ?? 'unknown',
      raw: payment,
    }
  }

  private extractTransferItems(response: Record<string, unknown>): Array<{ id: string }> {
    if (Array.isArray(response.items)) return response.items as Array<{ id: string }>
    const transfers = response.transfers as Record<string, unknown> | undefined
    if (transfers && Array.isArray(transfers.items)) return transfers.items as Array<{ id: string }>
    return []
  }

  private normalizeEventType(eventName: string): NormalizedWebhookEvent['type'] {
    switch (eventName) {
      case 'payment.authorized': return NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED
      case 'payment.captured':   return NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED
      case 'order.paid':         return NORMALIZED_EVENT_TYPE.ORDER_PAID
      case 'payment.failed':     return NORMALIZED_EVENT_TYPE.PAYMENT_FAILED
      case 'refund.processed':   return NORMALIZED_EVENT_TYPE.REFUND_PROCESSED
      default:                   return NORMALIZED_EVENT_TYPE.UNKNOWN
    }
  }

  private async releaseTransferHoldRaw(transferId: string): Promise<void> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')
    const response = await fetch(`https://api.razorpay.com/v1/transfers/${transferId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({ on_hold: false }),
    })
    if (!response.ok) {
      const body = await response.text()
      throw new PaymentError(`Razorpay transfer release failed: ${response.status} ${body}`)
    }
    this.logger.info({ transferId }, 'Razorpay SafePay transfer hold released (raw API)')
  }
}
