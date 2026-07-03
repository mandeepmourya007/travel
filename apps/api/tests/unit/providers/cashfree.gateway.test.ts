/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CashfreeGateway unit tests.
 *
 * Verifies:
 * - HMAC webhook scheme (timestamp + rawBody → base64)
 * - Auto-capture behavior (capturePayment = no-op status-fetch)
 * - verifyClientCallback = server-side order status fetch
 * - Status normalization (PAID → paid, ACTIVE → created)
 * - Event type normalization
 * - Refund delegation (requires orderId in notes)
 * - Error wrapping
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { CashfreeGateway } from '../../../src/providers/payment/cashfree.gateway'
import { AuthError, PaymentError } from '../../../src/errors/app-error'
import { NORMALIZED_EVENT_TYPE } from '../../../src/types/payment.types'
import type { CashfreeConfig } from '../../../src/config/cashfree'
import {
  CF_VENDOR_ID_PREFIX,
  CF_ERROR_CODE,
  CF_VENDORS_PATH,
  CF_VENDOR_STATUS_ACTIVE,
  CF_SCHEDULE_OPTION_T1,
  CF_BUSINESS_TYPE,
} from '../../../src/providers/payment/payment.constants'

vi.mock('../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    CASHFREE_APP_ID: 'cf_test_app',
    CASHFREE_SECRET_KEY: 'cf_test_secret',
    CASHFREE_WEBHOOK_SECRET: 'cf_webhook_secret',
    CASHFREE_ENV: 'sandbox',
  },
}))

const CF_WEBHOOK_SECRET = 'cf_webhook_secret'

const testConfig: CashfreeConfig = {
  appId: 'cf_test_app',
  secretKey: 'cf_test_secret',
  webhookSecret: CF_WEBHOOK_SECRET,
  baseUrl: 'https://sandbox.cashfree.com/pg',
  apiVersion: '2023-08-01',
  environment: 'sandbox',
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

let gateway: CashfreeGateway

beforeEach(() => {
  vi.clearAllMocks()
  gateway = new CashfreeGateway(testConfig, mockLogger as any)
  // Reset fetch mock before each test
  vi.stubGlobal('fetch', vi.fn())
})

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  ;(globalThis.fetch as any).mockResolvedValue({
    ok,
    status,
    json: async () => body,
  })
}

// ═══════════════════════════════════════════════════
// verifyAndParseWebhook — HMAC + normalization
// ═══════════════════════════════════════════════════
describe('verifyAndParseWebhook', () => {
  function buildWebhookBody(type: string, orderId: string, cfPaymentId: number) {
    return Buffer.from(JSON.stringify({
      type,
      data: {
        order: { order_id: orderId },
        payment: { cf_payment_id: cfPaymentId, payment_status: 'SUCCESS', payment_message: null },
      },
    }))
  }

  function makeSignature(timestamp: string, rawBody: Buffer) {
    return crypto
      .createHmac('sha256', CF_WEBHOOK_SECRET)
      .update(timestamp + rawBody.toString())
      .digest('base64')
  }

  it('should throw AuthError when headers are missing', () => {
    const rawBody = buildWebhookBody('PAYMENT_SUCCESS_WEBHOOK', 'order_1', 12345)
    expect(() => gateway.verifyAndParseWebhook(rawBody, {})).toThrow(AuthError)
  })

  it('should throw AuthError for a tampered signature', () => {
    const rawBody = buildWebhookBody('PAYMENT_SUCCESS_WEBHOOK', 'order_1', 12345)
    const headers = {
      'x-webhook-timestamp': '1700000000',
      'x-webhook-signature': 'dGFtcGVyZWQ=',  // base64("tampered")
    }
    expect(() => gateway.verifyAndParseWebhook(rawBody, headers)).toThrow(AuthError)
  })

  it('should parse PAYMENT_SUCCESS_WEBHOOK → PAYMENT_CAPTURED', () => {
    const rawBody = buildWebhookBody('PAYMENT_SUCCESS_WEBHOOK', 'order_cf_1', 99001)
    const timestamp = '1700000001'
    const headers = {
      'x-webhook-timestamp': timestamp,
      'x-webhook-signature': makeSignature(timestamp, rawBody),
    }

    const event = gateway.verifyAndParseWebhook(rawBody, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED)
    expect(event.orderId).toBe('order_cf_1')
    expect(event.paymentId).toBe('99001')
    expect(event.rawEventName).toBe('PAYMENT_SUCCESS_WEBHOOK')
  })

  it('should parse PAYMENT_FAILED_WEBHOOK → PAYMENT_FAILED', () => {
    const body = Buffer.from(JSON.stringify({
      type: 'PAYMENT_FAILED_WEBHOOK',
      data: {
        order: { order_id: 'order_cf_fail' },
        payment: { cf_payment_id: 99002, payment_status: 'FAILED', payment_message: 'Card declined' },
      },
    }))
    const timestamp = '1700000002'
    const headers = {
      'x-webhook-timestamp': timestamp,
      'x-webhook-signature': makeSignature(timestamp, body),
    }

    const event = gateway.verifyAndParseWebhook(body, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.PAYMENT_FAILED)
    expect(event.failureReason).toBe('Card declined')
  })

  it('should parse REFUND_STATUS_WEBHOOK → REFUND_PROCESSED', () => {
    const body = Buffer.from(JSON.stringify({
      type: 'REFUND_STATUS_WEBHOOK',
      data: {
        order: { order_id: 'order_cf_ref' },
        refund: { cf_refund_id: 'rfnd_123' },
        payment: { cf_payment_id: 99003 },
      },
    }))
    const timestamp = '1700000003'
    const headers = {
      'x-webhook-timestamp': timestamp,
      'x-webhook-signature': makeSignature(timestamp, body),
    }

    const event = gateway.verifyAndParseWebhook(body, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.REFUND_PROCESSED)
    expect(event.refundId).toBe('rfnd_123')
  })

  it('should return UNKNOWN for unrecognized event types', () => {
    const rawBody = Buffer.from(JSON.stringify({ type: 'SETTLEMENT_WEBHOOK', data: {} }))
    const timestamp = '1700000004'
    const headers = {
      'x-webhook-timestamp': timestamp,
      'x-webhook-signature': makeSignature(timestamp, rawBody),
    }

    const event = gateway.verifyAndParseWebhook(rawBody, headers)

    expect(event.type).toBe(NORMALIZED_EVENT_TYPE.UNKNOWN)
  })
})

// ═══════════════════════════════════════════════════
// createOrder — NormalizedOrder shape + splits
// ═══════════════════════════════════════════════════
describe('createOrder', () => {
  it('should return NormalizedOrder with provider=cashfree and paymentSessionId', async () => {
    mockFetchResponse({
      cf_order_id: 'cf_order_abc',
      order_status: 'ACTIVE',
      payment_session_id: 'paysession_xyz',
    })

    const result = await gateway.createOrder({
      amountPaise: 500000,
      receipt: 'booking-cf-test',
      notes: { tripId: 'trip-1' },
    })

    expect(result.orderId).toBe('booking-cf-test')  // We use receipt as orderId
    expect(result.clientPayload.provider).toBe('cashfree')
    expect((result.clientPayload as any).paymentSessionId).toBe('paysession_xyz')
    expect(result.status).toBe('created')  // ACTIVE → created
  })

  it('should include order_splits when split param is provided', async () => {
    mockFetchResponse({ cf_order_id: 'cf_split', payment_session_id: 'paysession_split', order_status: 'ACTIVE' })

    await gateway.createOrder({
      amountPaise: 1000000,
      receipt: 'booking-split',
      notes: {},
      split: {
        vendorAccountId: 'cf_vendor_123',
        vendorAmountPaise: 900000,
        holdUntilEpochSec: 1800000000,
      },
    })

    const fetchCall = (globalThis.fetch as any).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.order_splits).toBeDefined()
    expect(requestBody.order_splits[0].vendor_id).toBe('cf_vendor_123')
    expect(requestBody.order_splits[0].amount).toBe(9000)  // 900000 paise → 9000 rupees
    // Must not include percentage — spec says use amount OR percentage, not both
    expect(requestBody.order_splits[0].percentage).toBeUndefined()
  })

  it('should convert paise → rupees for order_amount', async () => {
    mockFetchResponse({ payment_session_id: 'ps_conv', order_status: 'ACTIVE' })

    await gateway.createOrder({
      amountPaise: 500000,  // 5000 rupees
      receipt: 'booking-conv',
      notes: {},
    })

    const requestBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)
    expect(requestBody.order_amount).toBe(5000)
  })

  it('should throw PaymentError when payment_session_id is missing in response', async () => {
    mockFetchResponse({ cf_order_id: 'cf_nosession', order_status: 'ACTIVE' })

    await expect(
      gateway.createOrder({ amountPaise: 100000, receipt: 'booking-nosess', notes: {} }),
    ).rejects.toThrow(PaymentError)
  })

  it('should throw PaymentError when API returns non-OK status', async () => {
    mockFetchResponse({ message: 'Invalid credentials' }, false, 401)

    await expect(
      gateway.createOrder({ amountPaise: 100000, receipt: 'booking-err', notes: {} }),
    ).rejects.toThrow(PaymentError)
  })
})

// ═══════════════════════════════════════════════════
// capturePayment — auto-capture (no-op / status fetch)
// ═══════════════════════════════════════════════════
describe('capturePayment', () => {
  it('should return captured status when payment_status is SUCCESS', async () => {
    mockFetchResponse({ cf_payment_id: 99001, payment_status: 'SUCCESS' })

    const result = await gateway.capturePayment('99001', 500000)

    expect(result.status).toBe('captured')
    expect(result.paymentId).toBe('99001')
  })

  it('should return captured gracefully on fetch failure (auto-capture safety net)', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('Network error'))

    const result = await gateway.capturePayment('99001', 500000)

    expect(result.status).toBe('captured')  // Optimistic: Cashfree auto-captures
  })
})

// ═══════════════════════════════════════════════════
// verifyClientCallback — server-side order status check
// ═══════════════════════════════════════════════════
describe('verifyClientCallback', () => {
  it('should return true when order_status is PAID', async () => {
    mockFetchResponse({ order_id: 'order_cf_1', order_status: 'PAID' })

    const result = await gateway.verifyClientCallback({ orderId: 'order_cf_1' })

    expect(result).toBe(true)
  })

  it('should return false when order_status is ACTIVE (not yet paid)', async () => {
    mockFetchResponse({ order_id: 'order_cf_1', order_status: 'ACTIVE' })

    const result = await gateway.verifyClientCallback({ orderId: 'order_cf_1' })

    expect(result).toBe(false)
  })

  it('should return false on fetch failure', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('timeout'))

    const result = await gateway.verifyClientCallback({ orderId: 'order_cf_fail' })

    expect(result).toBe(false)
  })
})

// ═══════════════════════════════════════════════════
// checkOrderStatus — Cashfree → normalized vocabulary
// ═══════════════════════════════════════════════════
describe('checkOrderStatus', () => {
  it.each([
    ['PAID', 'paid'],
    ['ACTIVE', 'created'],
    ['EXPIRED', 'expired'],
    ['CANCELLED', 'cancelled'],
  ])('should normalize %s → %s', async (cfStatus, expected) => {
    mockFetchResponse({ order_status: cfStatus })

    const result = await gateway.checkOrderStatus('order_cf_1')

    expect(result).toBe(expected)
  })
})

// ═══════════════════════════════════════════════════
// initiateRefund — requires orderId in notes
// ═══════════════════════════════════════════════════
describe('initiateRefund', () => {
  it('should throw PaymentError when orderId is missing from notes', async () => {
    await expect(
      gateway.initiateRefund('pay_cf_1', 50000, { reason: 'cancellation' }),
    ).rejects.toThrow('orderId')
  })

  it('should call POST /orders/:orderId/refunds with rupee amount and deterministic refund_id', async () => {
    mockFetchResponse({ cf_refund_id: 'rfnd_abc', refund_status: 'SUCCESS' })

    const result = await gateway.initiateRefund('pay_cf_1', 50000, {
      orderId: 'order_cf_for_refund',
      reason: 'cancellation',
    })

    expect(result.refundId).toBe('rfnd_abc')
    const fetchCall = (globalThis.fetch as any).mock.calls[0]
    expect(fetchCall[0]).toContain('/orders/order_cf_for_refund/refunds')
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.refund_amount).toBe(500)  // 50000 paise → 500 rupees
    // refund_id must be deterministic (orderId-based) so Cashfree deduplicates retries
    expect(requestBody.refund_id).toBe('REFUND_order_cf_for_refund')
    expect(requestBody.refund_note).toBe('cancellation')
  })

  it('should use same refund_id on retry (idempotency — not Date.now())', async () => {
    mockFetchResponse({ cf_refund_id: 'rfnd_idempotent' })

    const notes = { orderId: 'order_retry_test', reason: 'cancelled' }
    await gateway.initiateRefund('pay_cf_x', 90000, notes)
    const body1 = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)

    vi.clearAllMocks()
    mockFetchResponse({ cf_refund_id: 'rfnd_idempotent' })
    await gateway.initiateRefund('pay_cf_x', 90000, notes)
    const body2 = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)

    expect(body1.refund_id).toBe(body2.refund_id)
  })

  it('should fall back to local refund_id when cf_refund_id is absent in response', async () => {
    mockFetchResponse({ refund_status: 'PENDING' })  // no cf_refund_id

    const result = await gateway.initiateRefund('pay_cf_fallback', 20000, { orderId: 'order_noid' })

    expect(result.refundId).toBe('REFUND_order_noid')
  })
})

// ═══════════════════════════════════════════════════
// createPayoutAccount — Easy Split vendor creation
// ═══════════════════════════════════════════════════
describe('createPayoutAccount', () => {
  const params = {
    referenceId: 'orgp-1234-abcd-efgh-ijkl',
    businessName: 'Rahul Travels',
    contactName: 'Rahul Sharma',
    email: 'rahul@example.com',
    phone: '9876543210',
    pan: 'ABCDE1234F',
    accountType: 'INDIVIDUAL' as const,
    bank: { accountNumber: '12345678901234', ifsc: 'SBIN0001234', beneficiaryName: 'Rahul Sharma' },
  }

  const expectedVendorId = `${CF_VENDOR_ID_PREFIX}${params.referenceId.slice(0, 20).replace(/-/g, '_')}`

  it('builds a deterministic vendorId from referenceId', async () => {
    mockFetchResponse({ vendorId: expectedVendorId, status: CF_VENDOR_STATUS_ACTIVE })

    const result = await gateway.createPayoutAccount(params)

    expect(result.accountId).toBe(expectedVendorId)
    expect(result.provider).toBe('cashfree')
  })

  it('posts to CF_VENDORS_PATH with correct body shape', async () => {
    mockFetchResponse({ vendorId: expectedVendorId, status: CF_VENDOR_STATUS_ACTIVE })

    await gateway.createPayoutAccount(params)

    const [url, opts] = (globalThis.fetch as any).mock.calls[0]
    expect(url).toContain(CF_VENDORS_PATH)
    const body = JSON.parse(opts.body as string)
    expect(body.vendor_id).toBe(expectedVendorId)
    expect(body.status).toBe(CF_VENDOR_STATUS_ACTIVE)
    expect(body.email).toBe(params.email)
    expect(body.kyc_details.account_type).toBe('INDIVIDUAL')
    expect(body.kyc_details.business_type).toBe(CF_BUSINESS_TYPE)
    expect(body.kyc_details.pan).toBe('ABCDE1234F')
    expect(body.schedule_option).toBe(CF_SCHEDULE_OPTION_T1)
    expect(body.bank.account_number).toBe(params.bank.accountNumber)
    expect(body.bank.ifsc).toBe(params.bank.ifsc)
    expect(body.bank.account_holder).toBe(params.bank.beneficiaryName)
  })

  it('sets verify_account=false in sandbox environment', async () => {
    mockFetchResponse({ vendorId: expectedVendorId, status: CF_VENDOR_STATUS_ACTIVE })

    await gateway.createPayoutAccount(params)

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)
    expect(body.verify_account).toBe(false)
  })

  it('sets verify_account=true in production environment', async () => {
    const prodGateway = new CashfreeGateway({ ...testConfig, environment: 'production' }, mockLogger as any)
    mockFetchResponse({ vendorId: expectedVendorId, status: CF_VENDOR_STATUS_ACTIVE })

    await prodGateway.createPayoutAccount(params)

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)
    expect(body.verify_account).toBe(true)
  })

  it('uses CF_FALLBACK_PHONE when organizer has no phone', async () => {
    mockFetchResponse({ vendorId: expectedVendorId, status: CF_VENDOR_STATUS_ACTIVE })

    await gateway.createPayoutAccount({ ...params, phone: null })

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body)
    expect(body.phone).toBe('9999999999')
  })

  it('returns status from Cashfree response', async () => {
    mockFetchResponse({ vendorId: expectedVendorId, status: 'IN_BENE_CREATION' })

    const result = await gateway.createPayoutAccount(params)

    expect(result.status).toBe('IN_BENE_CREATION')
  })

  it('treats vendor_already_exists error as idempotent success', async () => {
    mockFetchResponse({ code: CF_ERROR_CODE.VENDOR_ALREADY_EXISTS, message: 'Vendor already exists' }, false, 409)

    const result = await gateway.createPayoutAccount(params)

    expect(result.accountId).toBe(expectedVendorId)
    expect(result.provider).toBe('cashfree')
    expect(result.status).toBe(CF_VENDOR_STATUS_ACTIVE)
  })

  it('throws PaymentError when pan is absent', async () => {
    await expect(
      gateway.createPayoutAccount({ ...params, pan: undefined }),
    ).rejects.toThrow(PaymentError)
  })

  it('throws PaymentError when accountType is absent', async () => {
    await expect(
      gateway.createPayoutAccount({ ...params, accountType: undefined }),
    ).rejects.toThrow(PaymentError)
  })

  it('re-throws PaymentError for other API failures', async () => {
    mockFetchResponse({ message: 'Invalid bank account details' }, false, 422)

    await expect(gateway.createPayoutAccount(params)).rejects.toThrow(PaymentError)
  })
})
