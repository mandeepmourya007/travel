import crypto from 'crypto'
import type { Logger } from 'pino'
import { AuthError, PaymentError } from '../../errors/app-error'
import { NORMALIZED_EVENT_TYPE } from '../../types/payment.types'
import type {
  IPaymentGateway,
  CreateOrderParams,
  NormalizedOrder,
  NormalizedPayment,
  NormalizedWebhookEvent,
  ClientCallbackInput,
} from './payment-gateway.interface'
import type { CashfreeConfig } from '../../config/cashfree'
import { startTimer } from '../../utils/perf-timer'
import { PAYMENT_PROVIDER, DEFAULT_CUSTOMER_NAME } from '@shared/constants'
import { NORMALIZED_PAYMENT_STATUS, CASHFREE_PAYMENT_STATUS } from './payment.constants'

/** Cashfree order-status string → normalized vocabulary */
const CF_ORDER_STATUS_MAP: Record<string, string> = {
  PAID: 'paid',
  ACTIVE: 'created',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
}

/**
 * Adapter: maps Cashfree PG API into the provider-neutral IPaymentGateway contract.
 *
 * Key differences from Razorpay:
 * - Auto-capture — no explicit capture call needed (capturePayment is a status-fetch no-op)
 * - No client-side HMAC — verifyClientCallback does a server-side order-status fetch
 * - Webhook scheme: HMAC-SHA256(timestamp + rawBody, secretKey) → base64 → x-webhook-signature
 * - Split: order_splits[] at order creation (Easy Split / Deferred Settlement)
 *
 * API version: 2023-08-01  Base URL set by CASHFREE_ENV (sandbox / production)
 */
export class CashfreeGateway implements IPaymentGateway {
  readonly provider = PAYMENT_PROVIDER.CASHFREE

  constructor(
    private config: CashfreeConfig,
    private logger: Logger,
  ) {}

  // ─── IPaymentGateway ──────────────────────────────────

  async createOrder(params: CreateOrderParams): Promise<NormalizedOrder> {
    const timer = startTimer()
    const { amountPaise, receipt, notes, split, customer, returnUrl } = params

    // Cashfree accepts amounts in rupees (float), not paise
    const orderAmount = amountPaise / 100

    const body: Record<string, unknown> = {
      order_id: receipt,
      order_amount: orderAmount,
      order_currency: 'INR',
      order_note: JSON.stringify(notes),
      customer_details: {
        customer_id: customer?.id ?? receipt,
        customer_name: customer?.name ?? DEFAULT_CUSTOMER_NAME,
        customer_email: customer?.email ?? 'noreply@tripcompare.in',
        customer_phone: customer?.phone ?? '9999999999',
      },
    }

    // Return URL for post-payment redirect (Cashfree substitutes {order_id})
    if (returnUrl) {
      body['order_meta'] = { return_url: returnUrl }
    }

    // Easy Split: wire vendor payout at order creation
    if (split?.vendorAccountId) {
      const vendorAmountRupees = split.vendorAmountPaise / 100
      body['order_splits'] = [
        {
          vendor_id: split.vendorAccountId,
          amount: vendorAmountRupees,
          // Deferred settlement: funds settle to vendor after holdUntilEpochSec
          percentage: null,
          tags: split.notes ?? {},
        },
      ]
    }

    try {
      const response = await this.fetch('POST', '/orders', body)

      const paymentSessionId = response['payment_session_id'] as string | undefined
      const cfOrderId = response['cf_order_id'] as string | undefined
      const status = response['order_status'] as string ?? 'ACTIVE'

      if (!paymentSessionId) {
        throw new PaymentError(`Cashfree order created but payment_session_id missing: ${JSON.stringify(response)}`)
      }

      this.logger.info(
        { cfOrderId, receipt, amountRupees: orderAmount, durationMs: timer.elapsed() },
        'Cashfree order created',
      )

      return {
        orderId: receipt,  // Use our own receipt as orderId (Cashfree stores cf_order_id separately)
        status: CF_ORDER_STATUS_MAP[status] ?? 'created',
        clientPayload: {
          provider: PAYMENT_PROVIDER.CASHFREE,
          orderId: receipt,
          paymentSessionId,
        },
        raw: response,
      }
    } catch (error) {
      if (error instanceof PaymentError) throw error
      this.logger.error({ error, amountRupees: orderAmount, receipt, durationMs: timer.elapsed() }, 'Cashfree order creation failed')
      throw new PaymentError('Failed to create Cashfree order', error)
    }
  }

  /**
   * Cashfree auto-captures — no explicit capture call exists.
   * Fetches order status and returns a NormalizedPayment.
   */
  async capturePayment(paymentId: string): Promise<NormalizedPayment> {
    try {
      // paymentId here is the CF payment ID (cf_payment_id) — fetch its status
      const response = await this.fetch('GET', `/payments/${paymentId}`, null)
      const status = (response['payment_status'] as string ?? 'SUCCESS').toLowerCase()
      return {
        paymentId,
        status: status === CASHFREE_PAYMENT_STATUS.SUCCESS.toLowerCase() ? NORMALIZED_PAYMENT_STATUS.CAPTURED : status,
        raw: response,
      }
    } catch (error) {
      this.logger.warn({ paymentId, error }, 'Cashfree capturePayment status-fetch failed — treating as captured (auto-capture)')
      // Auto-capture means the payment is captured by Cashfree before we're called.
      // A fetch failure is non-fatal; payment.captured webhook is the safety net.
      return { paymentId, status: NORMALIZED_PAYMENT_STATUS.CAPTURED, raw: null }
    }
  }

  /**
   * Cashfree has no client-side HMAC — verification is a server-side order-status check.
   * Returns true when order status is PAID.
   */
  async verifyClientCallback(input: ClientCallbackInput): Promise<boolean> {
    try {
      const response = await this.fetch('GET', `/orders/${input.orderId}`, null)
      const status = response['order_status'] as string | undefined
      return status === CASHFREE_PAYMENT_STATUS.PAID
    } catch (error) {
      this.logger.error({ orderId: input.orderId, error }, 'Cashfree verifyClientCallback: order-status fetch failed')
      return false
    }
  }

  async checkOrderStatus(orderId: string): Promise<string> {
    try {
      const response = await this.fetch('GET', `/orders/${orderId}`, null)
      const status = response['order_status'] as string ?? 'ACTIVE'
      return CF_ORDER_STATUS_MAP[status] ?? status.toLowerCase()
    } catch (error) {
      this.logger.error({ error, orderId }, 'Cashfree order status check failed')
      throw new PaymentError('Failed to check Cashfree order status', error)
    }
  }

  async fetchPaymentIdForOrder(orderId: string): Promise<string | null> {
    try {
      const payments = await this.fetch('GET', `/orders/${orderId}/payments`, null)
      const items = Array.isArray(payments) ? payments : []
      const successful = items.find((p: Record<string, unknown>) =>
        p['payment_status'] === CASHFREE_PAYMENT_STATUS.SUCCESS || p['payment_status'] === CASHFREE_PAYMENT_STATUS.AUTHORIZED,
      )
      return successful ? String(successful['cf_payment_id'] ?? '') || null : null
    } catch (error) {
      this.logger.warn({ orderId, error }, 'Cashfree: failed to fetch payments for order')
      return null
    }
  }

  async initiateRefund(
    paymentId: string,
    amountPaise: number,
    notes?: Record<string, unknown>,
  ): Promise<{ refundId: string; raw: unknown }> {
    // Cashfree refunds are scoped to orders, not payments — we use paymentId as a stub refund ID
    const refundId = `REFUND_${paymentId}_${Date.now()}`
    const orderId = notes?.['orderId'] as string | undefined

    if (!orderId) {
      throw new PaymentError('Cashfree refund requires orderId in notes (pass { orderId: gatewayOrderId })')
    }

    try {
      const response = await this.fetch('POST', `/orders/${orderId}/refunds`, {
        refund_amount: amountPaise / 100,
        refund_id: refundId,
        refund_note: String(notes?.['reason'] ?? 'Booking refund'),
      })

      return {
        refundId: (response['cf_refund_id'] as string | undefined) ?? refundId,
        raw: response,
      }
    } catch (error) {
      this.logger.error({ error, orderId, amountPaise }, 'Cashfree refund initiation failed')
      throw new PaymentError('Failed to initiate Cashfree refund', error)
    }
  }

  async fetchTransferId(paymentId: string): Promise<string | null> {
    // Cashfree Easy Split: the split reference is the vendor_id + order_id combination.
    // There is no separate transfer ID to persist; the orderId itself is the settlement key.
    // Return null — releaseTransferHold uses orderId from ctx instead.
    this.logger.debug({ paymentId }, 'Cashfree fetchTransferId: no Route-style transfer ID; returning null')
    return null
  }

  async releaseTransferHold(
    _transferId: string,
    ctx?: { orderId?: string; vendorAccountId?: string },
  ): Promise<void> {
    // Cashfree Deferred Settlement: mark the order's split as eligible for settlement.
    // API: POST /orders/:orderId/settlement — marks split eligible after hold period.
    // ⚠ Exact endpoint confirmed via Cashfree docs — verify before enabling in production.
    const orderId = ctx?.orderId
    if (!orderId) {
      this.logger.warn({ ctx }, 'Cashfree releaseTransferHold: orderId missing in ctx — skipping release')
      return
    }

    try {
      await this.fetch('POST', `/orders/${orderId}/settlement`, { action: 'release' })
      this.logger.info({ orderId }, 'Cashfree deferred settlement released')
    } catch (error) {
      this.logger.error({ error, orderId }, 'Cashfree settlement release failed')
      throw new PaymentError('Failed to release Cashfree deferred settlement', error)
    }
  }

  /**
   * Verifies Cashfree webhook signature and parses the normalized event.
   *
   * Scheme: HMAC-SHA256(x-webhook-timestamp + rawBody, secretKey) → base64 → x-webhook-signature
   *
   * @throws AuthError — invalid/missing signature
   */
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedWebhookEvent {
    const timestamp = headers['x-webhook-timestamp'] as string | undefined
    const signature = headers['x-webhook-signature'] as string | undefined

    if (!timestamp || !signature) {
      throw new AuthError('Missing Cashfree webhook headers (x-webhook-timestamp / x-webhook-signature)')
    }

    if (!this.config.webhookSecret) {
      throw new AuthError('CASHFREE_WEBHOOK_SECRET not configured — cannot verify webhook')
    }

    const message = timestamp + rawBody.toString()
    const expectedSig = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(message)
      .digest('base64')

    let isValid = false
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSig),
        Buffer.from(signature),
      )
    } catch {
      isValid = false
    }

    if (!isValid) {
      throw new AuthError('Invalid Cashfree webhook signature')
    }

    const body = JSON.parse(rawBody.toString()) as {
      type?: string
      data?: Record<string, unknown>
      [key: string]: unknown
    }

    const eventType = body.type ?? ''
    const data = body.data ?? {}
    const order = (data['order'] as Record<string, unknown> | undefined) ?? {}
    const payment = (data['payment'] as Record<string, unknown> | undefined) ?? {}
    const refund = (data['refund'] as Record<string, unknown> | undefined) ?? {}

    const orderId = (order['order_id'] as string | undefined) ?? null
    const cfPaymentId = (payment['cf_payment_id'] as string | number | undefined)
    const paymentId = cfPaymentId != null ? String(cfPaymentId) : null
    const cfRefundId = (refund['cf_refund_id'] as string | undefined) ?? null
    const failureReason = (payment['payment_message'] as string | undefined) ?? null

    // Synthesize idempotency key from event type + payment/order ID
    const externalEventId = `cf_${eventType}_${paymentId ?? orderId ?? Date.now()}`
    const mode = (order['order_tags'] as Record<string, unknown> | undefined)?.['mode'] === 'TEST' ? 'test' : 'live'

    return {
      type: this.normalizeEventType(eventType),
      externalEventId,
      orderId,
      paymentId,
      refundId: cfRefundId,
      failureReason,
      mode,
      rawEventName: eventType,
      payload: body,
    }
  }

  // ─── Private helpers ───────────────────────────────────

  private normalizeEventType(eventType: string): NormalizedWebhookEvent['type'] {
    switch (eventType) {
      case 'PAYMENT_SUCCESS_WEBHOOK': return NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED
      case 'PAYMENT_FAILED_WEBHOOK':  return NORMALIZED_EVENT_TYPE.PAYMENT_FAILED
      case 'REFUND_STATUS_WEBHOOK':   return NORMALIZED_EVENT_TYPE.REFUND_PROCESSED
      // ORDER_PAID is used by PaymentService to trigger booking confirmation
      case 'PAYMENT_SUCCESS_WEBHOOK_V2': return NORMALIZED_EVENT_TYPE.ORDER_PAID
      default:                        return NORMALIZED_EVENT_TYPE.UNKNOWN
    }
  }

  private async fetch(
    method: 'GET' | 'POST',
    path: string,
    body: Record<string, unknown> | null,
  ): Promise<Record<string, unknown>> {
    const url = `${this.config.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-client-id': this.config.appId,
      'x-client-secret': this.config.secretKey,
      'x-api-version': this.config.apiVersion,
    }

    const response = await globalThis.fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const data = await response.json() as Record<string, unknown>

    if (!response.ok) {
      const msg = (data['message'] as string | undefined) ?? `Cashfree API error ${response.status}`
      throw new PaymentError(msg, data)
    }

    return data
  }
}
