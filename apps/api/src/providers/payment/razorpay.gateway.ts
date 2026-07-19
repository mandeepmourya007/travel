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
  CreatePayoutAccountParams,
  NormalizedPayoutAccount,
} from './payment-gateway.interface'
import { startTimer } from '../../utils/perf-timer'
import { PAYMENT_PROVIDER } from '@shared/constants'
import { env } from '../../config/env'
import { RAZORPAY_PAYMENT_STATUS, RZP_MOCK_ACCOUNT_PREFIX } from './payment.constants'

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
/**
 * The `razorpay` SDK's HTTP layer throws plain objects (`{ statusCode, error: {...} }`),
 * not `Error` instances (see node_modules/razorpay/dist/api.js `normalizeError`).
 * Sentry's LinkedErrors integration only walks `.cause` chains where the cause is an
 * `instanceof Error`, so a plain-object throw silently breaks error-chain visibility —
 * the real Razorpay failure reason (e.g. a 400 validation message) never reaches Sentry,
 * only our generic wrapper message. Normalize into a real Error before it becomes `cause`.
 */
function toGatewayError(error: unknown): Error {
  if (error instanceof Error) return error
  const rzp = error as { statusCode?: number; error?: { description?: string; code?: string; reason?: string } } | undefined
  const description = rzp?.error?.description ?? rzp?.error?.reason ?? rzp?.error?.code
  const normalized = new Error(
    description ? `Razorpay API error (${rzp?.statusCode ?? 'unknown'}): ${description}` : 'Unknown Razorpay API error',
  )
  return Object.assign(normalized, { statusCode: rzp?.statusCode, razorpayError: rzp?.error })
}

export class RazorpayGateway implements IPaymentGateway {
  readonly provider = PAYMENT_PROVIDER.RAZORPAY

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
          provider: PAYMENT_PROVIDER.RAZORPAY,
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
      throw new PaymentError('Failed to create Razorpay order', toGatewayError(error))
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
        if (p.status === RAZORPAY_PAYMENT_STATUS.CAPTURED) {
          this.logger.warn({ paymentId }, 'Capture threw but payment shows captured — treating as success')
          return this.normalizePayment(payment)
        }
      } catch (fetchErr) {
        this.logger.error({ paymentId, fetchErr }, 'Could not verify payment status after capture error')
      }

      this.logger.error({ error, paymentId, amountPaise }, 'Payment capture failed')
      throw new PaymentError('Failed to capture payment', toGatewayError(error))
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
      throw new PaymentError('Failed to check order status', toGatewayError(error))
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
        (p) => p.status === RAZORPAY_PAYMENT_STATUS.CAPTURED || p.status === RAZORPAY_PAYMENT_STATUS.AUTHORIZED,
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
      throw new PaymentError('Failed to initiate refund', toGatewayError(error))
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
      throw new PaymentError('Failed to release SafePay transfer', toGatewayError(error))
    }
  }

  /**
   * Razorpay has no on-demand vendor transfer API — SafePay uses a single escrow hold
   * per payment (transfers[] on_hold at order creation), released in full post-completion
   * via releaseTransferHold. There is no deposit/balance split on this gateway, so this
   * always throws; the balance-release cron only ever targets Cashfree bookings.
   *
   * @throws PaymentError — always, this operation is unsupported on Razorpay
   */
  async transferToVendor(): Promise<{ transferId: string; raw: unknown }> {
    throw new PaymentError('transferToVendor is not supported by RazorpayGateway — Razorpay uses a single SafePay escrow hold released via releaseTransferHold, not a deposit/balance split')
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

  /**
   * Creates a Razorpay Route linked account for the organizer.
   * In non-production environments or when keys are missing, returns a mock account ID.
   *
   * @throws PaymentError — Razorpay API failure
   */
  async createPayoutAccount(params: CreatePayoutAccountParams): Promise<NormalizedPayoutAccount> {
    if (!this.keyId || !this.keySecret || env.NODE_ENV !== 'production') {
      const accountId = `${RZP_MOCK_ACCOUNT_PREFIX}${params.referenceId.slice(0, 8)}`
      this.logger.warn({ accountId }, '[Razorpay] Non-production — returning mock payout account')
      return { accountId, provider: PAYMENT_PROVIDER.RAZORPAY, status: 'mock' }
    }

    // Razorpay's Route linked-account API requires legal_info.pan for business_type
    // "individual" — without it the API rejects the request with a 400. Mirrors the
    // guard already in cashfree.gateway.ts createPayoutAccount for the same field.
    if (!params.pan) {
      throw new PaymentError('PAN is required to create a Razorpay linked account')
    }

    const body = {
      email: params.email ?? `organizer-${params.referenceId}@placeholder.local`,
      phone: params.phone ? { primary: params.phone } : undefined,
      type: 'route',
      legal_business_name: params.businessName,
      business_type: 'individual',
      contact_name: params.contactName,
      profile: {
        category: 'tours_and_travel',
        subcategory: 'travel_agency',
        addresses: {
          registered: {
            street1: 'N/A', street2: 'N/A', city: 'N/A',
            state: 'N/A', postal_code: '000000', country: 'IN',
          },
        },
      },
      legal_info: { pan: params.pan },
      bank_account: {
        ifsc_code: params.bank.ifsc,
        beneficiary_name: params.bank.beneficiaryName,
        account_type: 'current',
        account_number: params.bank.accountNumber,
      },
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')
    const response = await fetch('https://api.razorpay.com/v2/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const sanitized = errorText.replace(/"account_number"\s*:\s*"[^"]+"/g, '"account_number":"[REDACTED]"')
      this.logger.error({ statusCode: response.status, body: sanitized }, 'Razorpay linked account creation failed')
      throw new PaymentError(`Failed to create payout account: ${response.status}`)
    }

    const data = await response.json() as { id: string }
    this.logger.info({ accountId: data.id }, 'Razorpay linked account created')
    return { accountId: data.id, provider: PAYMENT_PROVIDER.RAZORPAY, status: 'active', raw: data }
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
