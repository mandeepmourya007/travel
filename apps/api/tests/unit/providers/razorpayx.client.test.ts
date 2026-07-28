/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * RazorpayXClient unit tests.
 *
 * Modeled on tests/unit/providers/razorpay.gateway.test.ts — same mocking style
 * (hand-built SDK mock, vi.stubGlobal for fetch, real HMAC math for webhook
 * signature verification, not string comparison).
 *
 * Verifies:
 * - createContact / createFundAccount / createPayout request shapes (auth header,
 *   body fields, amount in paise)
 * - createPayout idempotency header name/value
 * - verifyAndParseWebhook HMAC verification + event normalization
 * - Error wrapping + no raw secrets in logs on non-2xx gateway responses
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { RazorpayXClient } from '../../../src/providers/payout/razorpayx.client'
import { AuthError, PaymentError } from '../../../src/errors/app-error'
import { NORMALIZED_EVENT_TYPE } from '../../../src/types/payment.types'

const WEBHOOK_SECRET = 'rzpx_webhook_secret_test'
const KEY_ID = 'rzpx_test_key_123'
const KEY_SECRET = 'rzpx_test_secret_456'
const ACCOUNT_NUMBER = '2323230012345678'

function makeRazorpaySdkMock() {
  return {
    key_id: KEY_ID,
    key_secret: KEY_SECRET,
    fundAccount: {
      create: vi.fn(),
    },
  }
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

let sdkMock: ReturnType<typeof makeRazorpaySdkMock>
let client: RazorpayXClient

beforeEach(() => {
  vi.clearAllMocks()
  sdkMock = makeRazorpaySdkMock()
  client = new RazorpayXClient(sdkMock as any, ACCOUNT_NUMBER, WEBHOOK_SECRET, mockLogger as any)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function expectedAuthHeader() {
  return `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`
}

// ═══════════════════════════════════════════════════
// createContact — raw-fetch, Basic-Auth, request shape
// ═══════════════════════════════════════════════════
describe('createContact', () => {
  it('POSTs to /v1/contacts with correct Basic-Auth header and body fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'cont_abc123' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await client.createContact({
      name: 'Rahul Sharma',
      email: 'rahul@example.com',
      contact: '9876543210',
      referenceId: 'orgp-1234',
    })

    expect(result.contactId).toBe('cont_abc123')
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.razorpay.com/v1/contacts')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe(expectedAuthHeader())

    const body = JSON.parse(opts.body as string)
    expect(body).toEqual({
      name: 'Rahul Sharma',
      email: 'rahul@example.com',
      contact: '9876543210',
      type: 'vendor',
      reference_id: 'orgp-1234',
    })
  })

  it('throws PaymentError on non-2xx response and logs without leaking the auth header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"error":"invalid contact"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      client.createContact({ name: 'Bad Contact', referenceId: 'orgp-bad' }),
    ).rejects.toThrow(PaymentError)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 422, referenceId: 'orgp-bad' }),
      expect.stringContaining('RazorpayX contact creation failed'),
    )
    // Sanitized logging — the logged fields never include the Basic-Auth secret
    const loggedFields = mockLogger.error.mock.calls[0][0]
    expect(JSON.stringify(loggedFields)).not.toContain(KEY_SECRET)
    expect(JSON.stringify(loggedFields)).not.toContain(expectedAuthHeader())
  })

  it('throws PaymentError (not the raw rejection) when fetch itself fails at the network level', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      client.createContact({ name: 'Rahul Sharma', referenceId: 'orgp-net-fail' }),
    ).rejects.toThrow(PaymentError)
  })
})

// ═══════════════════════════════════════════════════
// createFundAccount — SDK call, contact-based bank account shape
// ═══════════════════════════════════════════════════
describe('createFundAccount', () => {
  it('calls razorpay.fundAccount.create with contact_id + bank_account shape', async () => {
    sdkMock.fundAccount.create.mockResolvedValue({ id: 'fa_abc123' })

    const result = await client.createFundAccount({
      contactId: 'cont_abc123',
      accountNumber: '12345678901234',
      ifsc: 'SBIN0001234',
      beneficiaryName: 'Rahul Sharma',
    })

    expect(result.fundAccountId).toBe('fa_abc123')
    expect(sdkMock.fundAccount.create).toHaveBeenCalledWith({
      contact_id: 'cont_abc123',
      account_type: 'bank_account',
      bank_account: {
        name: 'Rahul Sharma',
        ifsc: 'SBIN0001234',
        account_number: '12345678901234',
      },
    })
  })

  it('throws PaymentError when the SDK call fails, without leaking the bank account number in the thrown error message', async () => {
    sdkMock.fundAccount.create.mockRejectedValue(new Error('Network error'))

    let caught: PaymentError | undefined
    try {
      await client.createFundAccount({
        contactId: 'cont_abc123',
        accountNumber: '99998888777766',
        ifsc: 'SBIN0001234',
        beneficiaryName: 'Rahul Sharma',
      })
    } catch (err) {
      caught = err as PaymentError
    }

    expect(caught).toBeInstanceOf(PaymentError)
    expect(caught?.message).not.toContain('99998888777766')
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 'cont_abc123' }),
      expect.stringContaining('RazorpayX fund account creation failed'),
    )
  })
})

// ═══════════════════════════════════════════════════
// createPayout — raw-fetch, idempotency header, amount in paise
// ═══════════════════════════════════════════════════
describe('createPayout', () => {
  it('POSTs to /v1/payouts with account_number, paise amount, and the idempotency header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'pout_abc123', status: 'processing' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await client.createPayout({
      fundAccountId: 'fa_abc123',
      amountPaise: 810000,
      idempotencyKey: 'PAYOUT_booking-1',
      notes: { bookingId: 'booking-1' },
    })

    expect(result.payoutId).toBe('pout_abc123')
    expect(result.status).toBe('processing')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.razorpay.com/v1/payouts')
    expect(opts.headers.Authorization).toBe(expectedAuthHeader())
    // Exact idempotency header name, per RazorpayX contract
    expect(opts.headers['X-Payout-Idempotency']).toBe('PAYOUT_booking-1')

    const body = JSON.parse(opts.body as string)
    expect(body.account_number).toBe(ACCOUNT_NUMBER)
    expect(body.fund_account_id).toBe('fa_abc123')
    expect(body.amount).toBe(810000) // paise, not rupees
    expect(body.currency).toBe('INR')
    expect(body.mode).toBe('IMPS')
    expect(body.purpose).toBe('payout')
    expect(body.queue_if_low_balance).toBe(true)
    expect(body.notes).toEqual({ bookingId: 'booking-1' })
  })

  it('defaults mode to IMPS when not provided, and honors an explicit mode override', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'pout_neft', status: 'processing' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await client.createPayout({
      fundAccountId: 'fa_abc123',
      amountPaise: 500000,
      idempotencyKey: 'PAYOUT_booking-2',
      mode: 'NEFT',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.mode).toBe('NEFT')
  })

  it('throws PaymentError on non-2xx response, logging the idempotency key but not the auth secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"insufficient balance"}',
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      client.createPayout({ fundAccountId: 'fa_x', amountPaise: 100000, idempotencyKey: 'PAYOUT_x' }),
    ).rejects.toThrow(PaymentError)

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, idempotencyKey: 'PAYOUT_x', fundAccountId: 'fa_x' }),
      expect.stringContaining('RazorpayX payout creation failed'),
    )
    const loggedFields = mockLogger.error.mock.calls[0][0]
    expect(JSON.stringify(loggedFields)).not.toContain(KEY_SECRET)
  })

  it('throws PaymentError (not the raw rejection) when fetch itself fails at the network level', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      client.createPayout({ fundAccountId: 'fa_net', amountPaise: 100000, idempotencyKey: 'PAYOUT_net' }),
    ).rejects.toThrow(PaymentError)
  })
})

// ═══════════════════════════════════════════════════
// verifyAndParseWebhook — real HMAC verification + normalization
// ═══════════════════════════════════════════════════
describe('verifyAndParseWebhook', () => {
  function buildRawBody(event: string, payoutId: string, extra: Record<string, unknown> = {}) {
    return Buffer.from(JSON.stringify({
      event,
      account_id: 'acc_test123',
      payload: { payout: { entity: { id: payoutId, status: 'processing', ...extra } } },
    }))
  }

  function realSignature(rawBody: Buffer) {
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
  }

  it('throws AuthError when x-razorpay-signature header is missing', () => {
    const rawBody = buildRawBody('payout.processing', 'pout_1')
    expect(() => client.verifyAndParseWebhook(rawBody, {})).toThrow(AuthError)
  })

  it('throws AuthError for a tampered/invalid signature (verified via real HMAC math, not string compare)', () => {
    const rawBody = buildRawBody('payout.processing', 'pout_1')
    // Well-formed hex of the correct length, but not the correct HMAC — proves the
    // client actually recomputes HMAC-SHA256(rawBody, secret) rather than accepting
    // any hex string.
    const wrongSig = crypto.createHmac('sha256', 'not_the_real_secret').update(rawBody).digest('hex')
    const headers = { 'x-razorpay-signature': wrongSig }
    expect(() => client.verifyAndParseWebhook(rawBody, headers)).toThrow(AuthError)
  })

  it('throws AuthError when the signature is not valid hex (timingSafeEqual guarded, not thrown raw)', () => {
    const rawBody = buildRawBody('payout.processing', 'pout_1')
    const headers = { 'x-razorpay-signature': 'not-hex-at-all!!' }
    expect(() => client.verifyAndParseWebhook(rawBody, headers)).toThrow(AuthError)
  })

  it('accepts a validly-signed payload and computes the exact HMAC the production code would', () => {
    const rawBody = buildRawBody('payout.processing', 'pout_valid')
    const signature = realSignature(rawBody)
    expect(signature).toBe(crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex'))

    const event = client.verifyAndParseWebhook(rawBody, { 'x-razorpay-signature': signature })
    expect(event.payoutId).toBe('pout_valid')
  })

  it.each([
    ['payout.processing', NORMALIZED_EVENT_TYPE.PAYOUT_PROCESSING],
    ['payout.processed', NORMALIZED_EVENT_TYPE.PAYOUT_PROCESSED],
    ['payout.reversed', NORMALIZED_EVENT_TYPE.PAYOUT_REVERSED],
    ['payout.failed', NORMALIZED_EVENT_TYPE.PAYOUT_FAILED],
    ['payout.rejected', NORMALIZED_EVENT_TYPE.PAYOUT_FAILED],
  ])('normalizes %s → %s', (rawEvent, expectedType) => {
    const rawBody = buildRawBody(rawEvent, 'pout_norm')
    const signature = realSignature(rawBody)

    const event = client.verifyAndParseWebhook(rawBody, { 'x-razorpay-signature': signature })

    expect(event.type).toBe(expectedType)
    expect(event.rawEventName).toBe(rawEvent)
    expect(event.payoutId).toBe('pout_norm')
  })

  it('returns UNKNOWN for an unrecognized event name', () => {
    const rawBody = buildRawBody('payout.queued', 'pout_unknown')
    const signature = realSignature(rawBody)

    const event = client.verifyAndParseWebhook(rawBody, { 'x-razorpay-signature': signature })

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.UNKNOWN)
  })

  it('extracts failureReason from payout.failed', () => {
    const rawBody = buildRawBody('payout.failed', 'pout_fail', { failure_reason: 'insufficient_funds' })
    const signature = realSignature(rawBody)

    const event = client.verifyAndParseWebhook(rawBody, { 'x-razorpay-signature': signature })

    expect(event.failureReason).toBe('insufficient_funds')
  })

  it('uses x-razorpay-event-id header for externalEventId when present', () => {
    const rawBody = buildRawBody('payout.processed', 'pout_dedup')
    const signature = realSignature(rawBody)
    const headers = {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'event_unique_123',
    }

    const event = client.verifyAndParseWebhook(rawBody, headers)

    expect(event.externalEventId).toBe('event_unique_123')
  })

  it('synthesizes externalEventId from event name + payoutId when the header is absent', () => {
    const rawBody = buildRawBody('payout.processed', 'pout_synth')
    const signature = realSignature(rawBody)

    const event = client.verifyAndParseWebhook(rawBody, { 'x-razorpay-signature': signature })

    expect(event.externalEventId).toBe('rzpx_payout.processed_pout_synth')
  })

  it('marks mode as test when account_id starts with rzp_test, live otherwise', () => {
    const testBody = Buffer.from(JSON.stringify({
      event: 'payout.processed',
      account_id: 'rzp_test_acc123',
      payload: { payout: { entity: { id: 'pout_mode_test' } } },
    }))
    const testSig = realSignature(testBody)
    const testEvent = client.verifyAndParseWebhook(testBody, { 'x-razorpay-signature': testSig })
    expect(testEvent.mode).toBe('test')

    const liveBody = Buffer.from(JSON.stringify({
      event: 'payout.processed',
      account_id: 'acc_live_123',
      payload: { payout: { entity: { id: 'pout_mode_live' } } },
    }))
    const liveSig = realSignature(liveBody)
    const liveEvent = client.verifyAndParseWebhook(liveBody, { 'x-razorpay-signature': liveSig })
    expect(liveEvent.mode).toBe('live')
  })
})
