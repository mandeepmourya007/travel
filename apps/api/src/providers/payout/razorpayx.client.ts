import crypto from 'crypto'
import type Razorpay from 'razorpay'
import type { Logger } from 'pino'
import { AuthError, PaymentError } from '../../errors/app-error'
import { NORMALIZED_EVENT_TYPE } from '../../types/payment.types'
import type { NormalizedPayoutWebhookEvent } from '../../types/payment.types'

/**
 * RazorpayX Payouts client — Contact -> Fund Account -> Payout, full API automation
 * (not the lighter Payout Links MVP). See docs/codebase/Payments & Webhooks.md
 * "RazorpayX Payouts" section and the plan this was built from.
 *
 * Deliberately does NOT implement IPaymentGateway and is NOT registered in
 * gatewayRegistry (config/dependencies.ts) — this is a one-directional
 * organizer-money-out client with its own resource model (Contact/FundAccount/Payout)
 * and webhook namespace, entirely separate from the traveller-payment order/capture/
 * refund flow. `razorpay` here is a SEPARATE SDK instance built from
 * RAZORPAYX_KEY_ID/SECRET — RazorpayX is its own signup, its own key pair, not the
 * shared PG client used by RazorpayGateway.
 *
 * NOT YET LIVE: no RazorpayX account exists yet (see plan doc). Every method here is
 * unit-testable with a mocked SDK/fetch, but none have been exercised against a real
 * RazorpayX sandbox — see docs/codebase/Payments & Webhooks.md callout.
 */
export class RazorpayXClient {
  constructor(
    private razorpay: Razorpay,
    private accountNumber: string,
    private webhookSecret: string,
    private logger: Logger,
  ) {}

  /**
   * Creates a RazorpayX Contact for an organizer — the first step of the
   * Contact -> Fund Account -> Payout chain. One contact per organizer, reused across
   * fund accounts/payouts.
   *
   * Raw-fetch (not the SDK) — mirrors RazorpayGateway.createPayoutAccount's raw fetch
   * to /v2/accounts, same Basic-Auth pattern.
   *
   * @throws PaymentError — RazorpayX API failure
   */
  async createContact(params: {
    name: string
    email?: string
    contact?: string
    referenceId: string
  }): Promise<{ contactId: string; raw: unknown }> {
    const body = {
      name: params.name,
      email: params.email,
      contact: params.contact,
      type: 'vendor',
      reference_id: params.referenceId,
    }

    const response = await this.fetchWithAuth('https://api.razorpay.com/v1/contacts', body)

    if (!response.ok) {
      const errorText = await response.text()
      this.logger.error({ statusCode: response.status, body: errorText, referenceId: params.referenceId }, 'RazorpayX contact creation failed')
      throw new PaymentError(`Failed to create RazorpayX contact: ${response.status}`)
    }

    const data = await response.json() as { id: string }
    this.logger.info({ contactId: data.id, referenceId: params.referenceId }, 'RazorpayX contact created')
    return { contactId: data.id, raw: data }
  }

  /**
   * Creates a RazorpayX Fund Account (bank account) linked to a Contact — the second
   * step of the chain, required before any Payout can be created.
   *
   * Uses the installed `razorpay` SDK's `fundAccount.create(...)` — its type defs are
   * shaped for customer-side accounts (`customer_id`), not RazorpayX's contact-based
   * accounts (`contact_id`), so the call is cast the same way razorpay.gateway.ts casts
   * SDK calls with a request shape the type defs don't cover (see `orders.create(... as any)`).
   *
   * @throws PaymentError — RazorpayX API failure
   */
  async createFundAccount(params: {
    contactId: string
    accountNumber: string
    ifsc: string
    beneficiaryName: string
  }): Promise<{ fundAccountId: string; raw: unknown }> {
    try {
      const payload = {
        contact_id: params.contactId,
        account_type: 'bank_account',
        bank_account: {
          name: params.beneficiaryName,
          ifsc: params.ifsc,
          account_number: params.accountNumber,
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fundAccount = await this.razorpay.fundAccount.create(payload as any)
      const id = (fundAccount as unknown as { id: string }).id

      this.logger.info({ fundAccountId: id, contactId: params.contactId }, 'RazorpayX fund account created')
      return { fundAccountId: id, raw: fundAccount }
    } catch (error) {
      this.logger.error({ error, contactId: params.contactId }, 'RazorpayX fund account creation failed')
      throw new PaymentError('Failed to create RazorpayX fund account', error)
    }
  }

  /**
   * Creates a RazorpayX Payout to a Fund Account — the final step, moves money out of
   * the platform's RazorpayX current account. Raw-fetch, same Basic-Auth pattern as
   * createContact/RazorpayGateway.createPayoutAccount.
   *
   * Idempotent via the X-Payout-Idempotency header (open item: verify exact header name
   * against RazorpayX docs once a real account exists — see plan doc).
   *
   * @throws PaymentError — RazorpayX API failure
   */
  async createPayout(params: {
    fundAccountId: string
    amountPaise: number
    idempotencyKey: string
    notes?: Record<string, unknown>
    mode?: string
  }): Promise<{ payoutId: string; status: string; raw: unknown }> {
    const body = {
      account_number: this.accountNumber,
      fund_account_id: params.fundAccountId,
      amount: params.amountPaise,
      currency: 'INR',
      mode: params.mode ?? 'IMPS',
      purpose: 'payout',
      queue_if_low_balance: true,
      notes: params.notes ?? {},
    }

    const response = await this.fetchWithAuth('https://api.razorpay.com/v1/payouts', body, {
      'X-Payout-Idempotency': params.idempotencyKey,
    })

    if (!response.ok) {
      const errorText = await response.text()
      this.logger.error(
        { statusCode: response.status, body: errorText, fundAccountId: params.fundAccountId, idempotencyKey: params.idempotencyKey },
        'RazorpayX payout creation failed',
      )
      throw new PaymentError(`Failed to create RazorpayX payout: ${response.status}`)
    }

    const data = await response.json() as { id: string; status: string }
    this.logger.info(
      { payoutId: data.id, status: data.status, fundAccountId: params.fundAccountId, idempotencyKey: params.idempotencyKey },
      'RazorpayX payout created',
    )
    return { payoutId: data.id, status: data.status, raw: data }
  }

  /**
   * Verifies the RazorpayX webhook HMAC-SHA256 signature, then parses and normalizes
   * the event. Same scheme as RazorpayGateway.verifyAndParseWebhook, adapted for
   * RazorpayX's payout.* event names (payout.processing/processed/reversed/failed/rejected).
   *
   * Scheme: HMAC-SHA256(rawBody, webhookSecret) -> hex -> compare x-razorpay-signature.
   *
   * @throws AuthError — invalid/missing signature
   */
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedPayoutWebhookEvent {
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
      throw new AuthError('Invalid RazorpayX webhook signature')
    }

    const body = JSON.parse(rawBody.toString()) as {
      event?: string
      account_id?: string
      payload?: { payout?: { entity?: { id?: string; status?: string; failure_reason?: string } } }
      [key: string]: unknown
    }

    const eventName = body.event ?? ''
    const payoutEntity = body.payload?.payout?.entity
    const payoutId = payoutEntity?.id ?? null
    const externalEventId = (headers['x-razorpay-event-id'] as string | undefined) ?? `rzpx_${eventName}_${payoutId}`
    const mode = body.account_id?.startsWith('rzp_test') ? 'test' : 'live'

    return {
      type: this.normalizeEventType(eventName),
      externalEventId,
      payoutId,
      failureReason: payoutEntity?.failure_reason ?? null,
      mode,
      rawEventName: eventName,
      payload: body,
    }
  }

  // ─── Private helpers ───────────────────────────────────

  private async fetchWithAuth(
    url: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<Response> {
    const keyId = (this.razorpay as unknown as { key_id: string }).key_id
    const keySecret = (this.razorpay as unknown as { key_secret: string }).key_secret
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      this.logger.error({ error, url }, 'RazorpayX request failed at network level')
      throw new PaymentError('Failed to reach RazorpayX API', error)
    }
  }

  private normalizeEventType(eventName: string): NormalizedPayoutWebhookEvent['type'] {
    switch (eventName) {
      case 'payout.processing': return NORMALIZED_EVENT_TYPE.PAYOUT_PROCESSING
      case 'payout.processed':  return NORMALIZED_EVENT_TYPE.PAYOUT_PROCESSED
      case 'payout.reversed':   return NORMALIZED_EVENT_TYPE.PAYOUT_REVERSED
      case 'payout.failed':
      case 'payout.rejected':   return NORMALIZED_EVENT_TYPE.PAYOUT_FAILED
      default:                  return NORMALIZED_EVENT_TYPE.UNKNOWN
    }
  }
}
