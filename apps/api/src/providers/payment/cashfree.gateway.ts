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
  CreatePayoutAccountParams,
  NormalizedPayoutAccount,
} from './payment-gateway.interface'
import type { CashfreeConfig } from '../../config/cashfree'
import { startTimer } from '../../utils/perf-timer'
import { PAYMENT_PROVIDER, DEFAULT_CUSTOMER_NAME } from '@shared/constants'
import {
  NORMALIZED_PAYMENT_STATUS,
  CASHFREE_PAYMENT_STATUS,
  CF_VENDOR_ID_PREFIX,
  CF_VENDOR_ID_REF_LENGTH,
  CF_FALLBACK_PHONE,
  CF_ERROR_CODE,
  CF_VENDORS_PATH,
  CF_VENDOR_STATUS_ACTIVE,
  CF_SCHEDULE_OPTION_INSTANT,
  CF_BUSINESS_TYPE,
} from './payment.constants'

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
 * API version: 2025-01-01  Base URL set by CASHFREE_ENV (sandbox / production)
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
      order_note: `Trip booking | ${Object.entries(notes).map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`).join(' | ')}`,
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
          // Use amount-based split only — do not include percentage (spec: use one or the other)
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
   * Cashfree auto-captures all payments server-side — no explicit capture API exists.
   * The PAYMENT_SUCCESS_WEBHOOK_V2 webhook is the authoritative confirmation.
   */
  async capturePayment(paymentId: string): Promise<NormalizedPayment> {
    return { paymentId, status: NORMALIZED_PAYMENT_STATUS.CAPTURED, raw: null }
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
    _paymentId: string,
    amountPaise: number,
    notes?: Record<string, unknown>,
  ): Promise<{ refundId: string; raw: unknown }> {
    const orderId = notes?.['orderId'] as string | undefined

    if (!orderId) {
      throw new PaymentError('Cashfree refund requires orderId in notes (pass { orderId: gatewayOrderId })')
    }

    // refund_id is Cashfree's idempotency key — must be deterministic per order so retries
    // on network timeouts return the existing refund rather than creating a second one.
    const refundId = `REFUND_${orderId}`

    try {
      const response = await this.fetch('POST', `/orders/${orderId}/refunds`, {
        refund_id: refundId,
        refund_amount: amountPaise / 100,
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
    // Cashfree Easy Split settles vendor shares automatically via the vendor's schedule_option
    // (T+1 by default) — there is no explicit "release hold" API like Razorpay Route.
    // SafePay escrow-on-hold is a Razorpay-only feature; Cashfree vendors are paid on their
    // schedule regardless of trip completion. This method is intentionally a no-op for Cashfree.
    this.logger.info({ orderId: ctx?.orderId }, 'Cashfree releaseTransferHold: no-op (Easy Split settles via schedule_option)')
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

    const orderId = (order['order_id'] as string | undefined) ?? (refund['order_id'] as string | undefined) ?? null
    // cf_payment_id lives under data.payment for payment events but under data.refund for refund events
    const cfPaymentId = (payment['cf_payment_id'] as string | number | undefined)
      ?? (refund['cf_payment_id'] as string | number | undefined)
    const paymentId = cfPaymentId != null ? String(cfPaymentId) : null
    const cfRefundId = (refund['cf_refund_id'] as string | undefined) ?? null
    const failureReason = (payment['payment_message'] as string | undefined) ?? null

    // Prefer refundId for refund events so retried webhooks deduplicate correctly.
    // Falling back to Date.now() would generate a different key per retry, defeating idempotency.
    const externalEventId = `cf_${eventType}_${cfRefundId ?? paymentId ?? orderId ?? Date.now()}`
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

  /**
   * Creates a Cashfree Easy Split vendor for the organizer.
   *
   * Vendor ID is derived deterministically from the organizer profile ID so that
   * a second call for the same organizer is idempotent (Cashfree rejects duplicate vendorIds).
   *
   * verifyAccount is enabled only in production because sandbox bank accounts are
   * only verifiable with the designated test bank (026291800001191 / YESB0000262).
   * @throws PaymentError — Cashfree API failure (includes validation errors if pan/accountType are absent)
   */
  async createPayoutAccount(params: CreatePayoutAccountParams): Promise<NormalizedPayoutAccount> {
    if (!params.pan || !params.accountType) {
      throw new PaymentError('pan and accountType are required for Cashfree vendor registration')
    }

    const vendorId = `${CF_VENDOR_ID_PREFIX}${params.referenceId.slice(0, CF_VENDOR_ID_REF_LENGTH).replace(/-/g, '_')}`

    const body = {
      vendor_id: vendorId,
      status: CF_VENDOR_STATUS_ACTIVE,
      name: params.businessName || params.contactName,
      email: params.email,
      phone: params.phone ?? CF_FALLBACK_PHONE,
      // In sandbox, skip instant bank verification — test banks require matching holder name "JANE DOE".
      // In production, always verify so mis-entered accounts are caught immediately.
      verify_account: this.config.environment === 'production',
      dashboard_access: false,
      schedule_option: CF_SCHEDULE_OPTION_INSTANT,
      kyc_details: {
        account_type: params.accountType,
        business_type: CF_BUSINESS_TYPE,
        pan: params.pan,
      },
      bank: {
        account_number: params.bank.accountNumber,
        account_holder: params.bank.beneficiaryName,
        ifsc: params.bank.ifsc,
      },
    }

    try {
      const data = await this.fetch('POST', CF_VENDORS_PATH, body)
      const status = (data['status'] as string | undefined) ?? 'CREATED'
      this.logger.info({ vendorId, status }, 'Cashfree Easy Split vendor created')
      return { accountId: vendorId, provider: PAYMENT_PROVIDER.CASHFREE, status, raw: data }
    } catch (error) {
      if (error instanceof PaymentError) {
        const responseBody = error.gatewayError as Record<string, unknown> | undefined
        const code = responseBody?.['code'] as string | undefined
        // Deterministic vendorId means a concurrent request may have already registered the same vendor.
        // Cashfree rejects duplicates — treat "vendor already exists" as idempotent success.
        if (code === CF_ERROR_CODE.VENDOR_ALREADY_EXISTS || error.message.toLowerCase().includes('already exists')) {
          this.logger.info({ vendorId }, 'Cashfree vendor already registered — treating as idempotent success')
          return { accountId: vendorId, provider: PAYMENT_PROVIDER.CASHFREE, status: CF_VENDOR_STATUS_ACTIVE }
        }
      }
      throw error
    }
  }

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

    // Retry logic for transient network errors (DNS, timeout, etc.)
    const maxRetries = 3
    const baseDelay = 1000 // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
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
      } catch (error) {
        const isTransientError =
          error instanceof TypeError && error.message.includes('fetch failed') ||
          error instanceof Error && error.message.includes('EAI_AGAIN') ||
          error instanceof Error && error.message.includes('ETIMEDOUT')

        if (!isTransientError || attempt === maxRetries) {
          throw error
        }

        const delay = baseDelay * Math.pow(2, attempt - 1)
        this.logger.warn({ attempt, delay, url }, 'Cashfree API request failed, retrying...')
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new PaymentError('Cashfree API request failed after retries')
  }
}
