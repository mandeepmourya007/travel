/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * RazorpayGateway unit tests.
 *
 * Verifies:
 * - HMAC schemes (client callback + webhook)
 * - Status normalization
 * - Idempotent capture handling
 * - Transfer ID extraction shapes
 * - Error wrapping
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { RazorpayGateway } from '../../../src/providers/payment/razorpay.gateway'
import { AuthError, PaymentError } from '../../../src/errors/app-error'
import { NORMALIZED_EVENT_TYPE } from '../../../src/types/payment.types'
import { RZP_MOCK_ACCOUNT_PREFIX } from '../../../src/providers/payment/payment.constants'

vi.mock('../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: 'test_secret',
    RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
  },
}))

import { env } from '../../../src/config/env'

const WEBHOOK_SECRET = 'wh_secret_test'
const KEY_SECRET = 'key_secret_test'
const KEY_ID = 'rzp_test_key123'

function makeRazorpayMock() {
  return {
    orders: {
      create: vi.fn(),
      fetch: vi.fn(),
      fetchPayments: vi.fn(),
    },
    payments: {
      capture: vi.fn(),
      fetch: vi.fn(),
      refund: vi.fn(),
    },
    transfers: {
      edit: vi.fn(),
    },
  }
}

let rzpMock: ReturnType<typeof makeRazorpayMock>
let gateway: RazorpayGateway

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

beforeEach(() => {
  vi.clearAllMocks()
  rzpMock = makeRazorpayMock()
  gateway = new RazorpayGateway(rzpMock as any, KEY_SECRET, WEBHOOK_SECRET, KEY_ID, mockLogger as any)
})

// ═══════════════════════════════════════════════════
// verifyClientCallback — HMAC-SHA256 client signature
// ═══════════════════════════════════════════════════
describe('verifyClientCallback', () => {
  function makeValidSignature(orderId: string, paymentId: string) {
    return crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex')
  }

  it('should return true for a valid HMAC signature', () => {
    const orderId = 'order_abc123'
    const paymentId = 'pay_xyz789'
    const signature = makeValidSignature(orderId, paymentId)

    expect(gateway.verifyClientCallback({ orderId, paymentId, signature })).toBe(true)
  })

  it('should return false for a tampered signature', () => {
    const orderId = 'order_abc123'
    const paymentId = 'pay_xyz789'
    const tampered = 'aabbccdd' + '0'.repeat(56)

    expect(gateway.verifyClientCallback({ orderId, paymentId, signature: tampered })).toBe(false)
  })

  it('should return false when signature is missing', () => {
    expect(gateway.verifyClientCallback({ orderId: 'order_x', paymentId: 'pay_y' })).toBe(false)
  })

  it('should return false when paymentId is missing', () => {
    // Without paymentId the HMAC is built over "orderId|" — any non-empty sig fails
    const sig = makeValidSignature('order_x', 'pay_real')
    expect(gateway.verifyClientCallback({ orderId: 'order_x', signature: sig })).toBe(false)
  })
})

// ═══════════════════════════════════════════════════
// verifyAndParseWebhook — HMAC + normalization
// ═══════════════════════════════════════════════════
describe('verifyAndParseWebhook', () => {
  function buildRawBody(event: string, orderId: string, paymentId: string) {
    return Buffer.from(JSON.stringify({
      event,
      account_id: 'acc_test123',
      payload: {
        payment: {
          entity: { id: paymentId, order_id: orderId, status: 'captured', error_description: null, error_code: null },
        },
        order: { entity: { id: orderId, status: 'paid' } },
      },
    }))
  }

  function makeSignature(rawBody: Buffer) {
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
  }

  it('should throw AuthError when x-razorpay-signature header is missing', () => {
    const rawBody = buildRawBody('payment.authorized', 'order_1', 'pay_1')
    expect(() => gateway.verifyAndParseWebhook(rawBody, {})).toThrow(AuthError)
  })

  it('should throw AuthError for a tampered body', () => {
    const rawBody = buildRawBody('payment.authorized', 'order_1', 'pay_1')
    const headers = { 'x-razorpay-signature': 'badhex' + '0'.repeat(56) }
    expect(() => gateway.verifyAndParseWebhook(rawBody, headers)).toThrow(AuthError)
  })

  it('should parse payment.authorized → PAYMENT_AUTHORIZED', () => {
    const rawBody = buildRawBody('payment.authorized', 'order_auth', 'pay_auth')
    const headers = { 'x-razorpay-signature': makeSignature(rawBody) }

    const event = gateway.verifyAndParseWebhook(rawBody, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
    expect(event.orderId).toBe('order_auth')
    expect(event.paymentId).toBe('pay_auth')
    expect(event.rawEventName).toBe('payment.authorized')
  })

  it('should parse payment.captured → PAYMENT_CAPTURED', () => {
    const rawBody = buildRawBody('payment.captured', 'order_cap', 'pay_cap')
    const headers = { 'x-razorpay-signature': makeSignature(rawBody) }

    const event = gateway.verifyAndParseWebhook(rawBody, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED)
  })

  it('should parse order.paid → ORDER_PAID', () => {
    const rawBody = buildRawBody('order.paid', 'order_paid', 'pay_paid')
    const headers = { 'x-razorpay-signature': makeSignature(rawBody) }

    const event = gateway.verifyAndParseWebhook(rawBody, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.ORDER_PAID)
  })

  it('should parse payment.failed → PAYMENT_FAILED with failure reason', () => {
    const body = Buffer.from(JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail',
            order_id: 'order_fail',
            error_description: 'Insufficient funds',
            error_code: 'BAD_REQUEST_ERROR',
          },
        },
      },
    }))
    const headers = { 'x-razorpay-signature': makeSignature(body) }

    const event = gateway.verifyAndParseWebhook(body, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.PAYMENT_FAILED)
    expect(event.failureReason).toBe('Insufficient funds')
  })

  it('should parse refund.processed → REFUND_PROCESSED with refundId from payload.refund.entity', () => {
    const rawBody = Buffer.from(JSON.stringify({
      event: 'refund.processed',
      account_id: 'acc_test123',
      payload: {
        payment: {
          entity: { id: 'pay_rzp_123', order_id: 'order_rzp_abc', status: 'refunded' },
        },
        refund: {
          entity: { id: 'rfnd_rzp_xyz', payment_id: 'pay_rzp_123', amount: 90000 },
        },
      },
    }))
    const headers = { 'x-razorpay-signature': makeSignature(rawBody) }

    const event = gateway.verifyAndParseWebhook(rawBody, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.REFUND_PROCESSED)
    expect(event.paymentId).toBe('pay_rzp_123')
    expect(event.orderId).toBe('order_rzp_abc')
    expect(event.refundId).toBe('rfnd_rzp_xyz')
  })

  it('should return UNKNOWN for unrecognized event names', () => {
    const rawBody = buildRawBody('order.payment.attempted', 'order_x', 'pay_x')
    const headers = { 'x-razorpay-signature': makeSignature(rawBody) }

    const event = gateway.verifyAndParseWebhook(rawBody, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.UNKNOWN)
  })

  it('should synthesize externalEventId from header when present', () => {
    const rawBody = buildRawBody('payment.authorized', 'order_1', 'pay_1')
    const sig = makeSignature(rawBody)
    const headers = {
      'x-razorpay-signature': sig,
      'x-razorpay-event-id': 'event_unique_id_123',
    }

    const event = gateway.verifyAndParseWebhook(rawBody, headers)

    expect(event.externalEventId).toBe('event_unique_id_123')
  })
})

// ═══════════════════════════════════════════════════
// createOrder — splits + NormalizedOrder shape
// ═══════════════════════════════════════════════════
describe('createOrder', () => {
  it('should return NormalizedOrder with provider=razorpay and razorpayKeyId', async () => {
    rzpMock.orders.create.mockResolvedValue({
      id: 'order_rzp_abc',
      status: 'created',
    })

    const result = await gateway.createOrder({
      amountPaise: 500000,
      receipt: 'booking-test',
      notes: { tripId: 'trip-1' },
    })

    expect(result.orderId).toBe('order_rzp_abc')
    expect(result.clientPayload.provider).toBe('razorpay')
    expect((result.clientPayload as any).razorpayKeyId).toBe(KEY_ID)
  })

  it('should include transfers[] in order payload when split is provided', async () => {
    rzpMock.orders.create.mockResolvedValue({ id: 'order_split', status: 'created' })

    await gateway.createOrder({
      amountPaise: 1000000,
      receipt: 'booking-split',
      notes: {},
      split: {
        vendorAccountId: 'acc_org123456789012',
        vendorAmountPaise: 900000,
        holdUntilEpochSec: 1800000000,
      },
    })

    const callArg = rzpMock.orders.create.mock.calls[0][0]
    expect(callArg.transfers).toBeDefined()
    expect(callArg.transfers[0].account).toBe('acc_org123456789012')
    expect(callArg.transfers[0].amount).toBe(900000)
    expect(callArg.transfers[0].on_hold).toBe(1)
  })

  it('should throw PaymentError on API failure', async () => {
    rzpMock.orders.create.mockRejectedValue(new Error('Network error'))

    await expect(
      gateway.createOrder({ amountPaise: 500000, receipt: 'booking-fail', notes: {} }),
    ).rejects.toThrow(PaymentError)
  })

  it('should throw ValidationError for zero amount', async () => {
    await expect(
      gateway.createOrder({ amountPaise: 0, receipt: 'booking-zero', notes: {} }),
    ).rejects.toThrow('greater than zero')
  })
})

// ═══════════════════════════════════════════════════
// capturePayment — idempotent handling
// ═══════════════════════════════════════════════════
describe('capturePayment', () => {
  it('should capture and return normalized payment', async () => {
    rzpMock.payments.capture.mockResolvedValue({ id: 'pay_abc', status: 'captured' })

    const result = await gateway.capturePayment('pay_abc', 500000)

    expect(result.paymentId).toBe('pay_abc')
    expect(result.status).toBe('captured')
  })

  it('should swallow "already captured" error and fetch existing', async () => {
    rzpMock.payments.capture.mockRejectedValue(new Error('payment has already been captured'))
    rzpMock.payments.fetch.mockResolvedValue({ id: 'pay_abc', status: 'captured' })

    const result = await gateway.capturePayment('pay_abc', 500000)

    expect(result.status).toBe('captured')
    expect(rzpMock.payments.fetch).toHaveBeenCalledWith('pay_abc')
  })

  it('should verify Razorpay status on transient error and succeed when already captured', async () => {
    rzpMock.payments.capture.mockRejectedValue(new Error('Gateway timeout'))
    rzpMock.payments.fetch.mockResolvedValue({ id: 'pay_abc', status: 'captured' })

    const result = await gateway.capturePayment('pay_abc', 500000)

    expect(result.status).toBe('captured')
  })
})

// ═══════════════════════════════════════════════════
// fetchTransferId — two response shapes
// ═══════════════════════════════════════════════════
describe('fetchTransferId', () => {
  it('should extract transfer ID from shape 1: response.items[]', async () => {
    rzpMock.payments.fetch.mockResolvedValue({
      id: 'pay_abc',
      items: [{ id: 'trf_item_123' }],
    })

    const result = await gateway.fetchTransferId('pay_abc')

    expect(result).toBe('trf_item_123')
  })

  it('should extract transfer ID from shape 2: response.transfers.items[]', async () => {
    rzpMock.payments.fetch.mockResolvedValue({
      id: 'pay_abc',
      transfers: { items: [{ id: 'trf_transfer_456' }] },
    })

    const result = await gateway.fetchTransferId('pay_abc')

    expect(result).toBe('trf_transfer_456')
  })

  it('should return null when no transfers found', async () => {
    rzpMock.payments.fetch.mockResolvedValue({ id: 'pay_abc' })

    const result = await gateway.fetchTransferId('pay_abc')

    expect(result).toBeNull()
  })

  it('should return null (not throw) on API error', async () => {
    rzpMock.payments.fetch.mockRejectedValue(new Error('API error'))

    const result = await gateway.fetchTransferId('pay_abc')

    expect(result).toBeNull()
  })
})

// ═══════════════════════════════════════════════════
// createPayoutAccount — payout onboarding
// ═══════════════════════════════════════════════════
describe('createPayoutAccount', () => {
  const params = {
    referenceId: 'orgp-1234-abcd-efgh',
    businessName: 'Rahul Travels',
    contactName: 'Rahul Sharma',
    email: 'rahul@example.com',
    phone: '9876543210',
    pan: 'ABCDE1234F',
    accountType: 'INDIVIDUAL' as const,
    bank: { accountNumber: '12345678901234', ifsc: 'SBIN0001234', beneficiaryName: 'Rahul Sharma' },
  }

  it('returns a mock account in non-production (NODE_ENV=test)', async () => {
    const result = await gateway.createPayoutAccount(params)

    expect(result.provider).toBe('razorpay')
    expect(result.status).toBe('mock')
    expect(result.accountId).toMatch(new RegExp(`^${RZP_MOCK_ACCOUNT_PREFIX}`))
    expect(result.accountId).toContain(params.referenceId.slice(0, 8))
  })

  it('mock account ID is derived deterministically from referenceId', async () => {
    const result1 = await gateway.createPayoutAccount(params)
    const result2 = await gateway.createPayoutAccount(params)

    expect(result1.accountId).toBe(result2.accountId)
  })

  it('calls Razorpay /v2/accounts in production and returns normalized account', async () => {
    ;(env as Record<string, unknown>)['NODE_ENV'] = 'production'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'acc_prod_12345', entity: 'account', type: 'route' }),
    }))

    try {
      const result = await gateway.createPayoutAccount(params)

      const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(url).toContain('/v2/accounts')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body as string)
      expect(body.type).toBe('route')
      expect(body.bank_account.account_number).toBe(params.bank.accountNumber)
      expect(body.bank_account.ifsc_code).toBe(params.bank.ifsc)

      expect(result.accountId).toBe('acc_prod_12345')
      expect(result.provider).toBe('razorpay')
      expect(result.status).toBe('active')
    } finally {
      ;(env as Record<string, unknown>)['NODE_ENV'] = 'test'
      vi.unstubAllGlobals()
    }
  })

  it('throws PaymentError when Razorpay /v2/accounts returns non-2xx in production', async () => {
    ;(env as Record<string, unknown>)['NODE_ENV'] = 'production'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"error":"invalid bank account"}',
    }))

    try {
      await expect(gateway.createPayoutAccount(params)).rejects.toThrow(PaymentError)
    } finally {
      ;(env as Record<string, unknown>)['NODE_ENV'] = 'test'
      vi.unstubAllGlobals()
    }
  })
})

// ═══════════════════════════════════════════════════
// initiateRefund — Route transfer reversal
// ═══════════════════════════════════════════════════
describe('initiateRefund', () => {
  it('should call payments.refund with amount, reverse_all:1, and notes', async () => {
    rzpMock.payments.refund.mockResolvedValue({ id: 'rfnd_abc123' })

    const result = await gateway.initiateRefund('pay_xyz', 90000, { bookingId: 'booking-1', reason: 'cancelled' })

    expect(rzpMock.payments.refund).toHaveBeenCalledWith('pay_xyz', expect.objectContaining({
      amount: 90000,
      reverse_all: 1,
      notes: { bookingId: 'booking-1', reason: 'cancelled' },
    }))
    expect(result.refundId).toBe('rfnd_abc123')
  })

  it('should return the raw Razorpay response alongside refundId', async () => {
    const raw = { id: 'rfnd_raw_1', status: 'processed', amount: 50000 }
    rzpMock.payments.refund.mockResolvedValue(raw)

    const result = await gateway.initiateRefund('pay_abc', 50000)

    expect(result.raw).toEqual(raw)
  })

  it('should throw PaymentError when Razorpay refund API fails', async () => {
    rzpMock.payments.refund.mockRejectedValue(new Error('Gateway timeout'))

    await expect(gateway.initiateRefund('pay_fail', 90000)).rejects.toThrow(PaymentError)
  })
})
