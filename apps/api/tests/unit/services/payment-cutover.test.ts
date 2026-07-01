/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Payment gateway cutover correctness tests.
 *
 * Verifies the critical invariant: in-flight transactions created under one provider
 * must continue to be routed to THAT provider after a gateway switch — never to the
 * new active gateway.
 *
 * Scenario: PAYMENT_GATEWAY switched from 'razorpay' → 'cashfree' mid-flight.
 * A Razorpay booking that was created before the cutover must still use
 * RazorpayGateway for refund / escrow-release / webhook processing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentService } from '../../../src/services/payment.service'

vi.mock('../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    RAZORPAY_KEY_ID: 'rzp_test_key',
    RAZORPAY_KEY_SECRET: 'test_secret',
    RAZORPAY_WEBHOOK_SECRET: 'test_webhook_secret',
  },
}))

const mockRazorpayGateway = {
  provider: 'razorpay' as const,
  createOrder: vi.fn(),
  capturePayment: vi.fn(),
  verifyClientCallback: vi.fn(),
  checkOrderStatus: vi.fn(),
  fetchPaymentIdForOrder: vi.fn(),
  initiateRefund: vi.fn().mockResolvedValue({ refundId: 'rzp_refund_123', raw: {} }),
  fetchTransferId: vi.fn(),
  releaseTransferHold: vi.fn().mockResolvedValue(undefined),
  verifyAndParseWebhook: vi.fn(),
}

const mockCashfreeGateway = {
  provider: 'cashfree' as const,
  createOrder: vi.fn(),
  capturePayment: vi.fn(),
  verifyClientCallback: vi.fn(),
  checkOrderStatus: vi.fn(),
  fetchPaymentIdForOrder: vi.fn(),
  initiateRefund: vi.fn(),
  fetchTransferId: vi.fn(),
  releaseTransferHold: vi.fn(),
  verifyAndParseWebhook: vi.fn(),
}

const mockPaymentTxRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findByGatewayOrderId: vi.fn(),
  findByGatewayPaymentId: vi.fn(),
  updateStatus: vi.fn(),
  updatePaymentId: vi.fn(),
  findCapturedTransfersForTrip: vi.fn(),
  findUnreleasedSafePays: vi.fn(),
  updateTransferId: vi.fn(),
}

const mockWebhookEventRepo = {
  findByExternalId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findById: vi.fn(),
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

// Registry: both gateways are available
const gatewayRegistry = new Map([
  ['razorpay' as const, mockRazorpayGateway],
  ['cashfree' as const, mockCashfreeGateway],
])

// Active gateway is now Cashfree (post-cutover)
let service: PaymentService

beforeEach(() => {
  vi.resetAllMocks()
  mockRazorpayGateway.initiateRefund.mockResolvedValue({ refundId: 'rzp_refund_123', raw: {} })
  mockRazorpayGateway.releaseTransferHold.mockResolvedValue(undefined)
  mockCashfreeGateway.initiateRefund.mockResolvedValue({ refundId: 'cf_refund_456', raw: {} })

  service = new PaymentService(
    mockCashfreeGateway as any,   // active = Cashfree (post-cutover)
    gatewayRegistry as any,
    mockPaymentTxRepo as any,
    mockWebhookEventRepo as any,
    mockLogger as any,
  )
})

describe('Gateway cutover routing', () => {
  it('should route capturePayment to Razorpay when tx.provider=razorpay (pre-cutover booking)', async () => {
    mockRazorpayGateway.capturePayment.mockResolvedValue({ paymentId: 'pay_rzp', status: 'captured', raw: {} })

    await service.capturePayment('pay_rzp_123', 500000, 'INR', 'razorpay')

    expect(mockRazorpayGateway.capturePayment).toHaveBeenCalledWith('pay_rzp_123', 500000, 'INR')
    expect(mockCashfreeGateway.capturePayment).not.toHaveBeenCalled()
  })

  it('should route capturePayment to Cashfree when tx.provider=cashfree (post-cutover booking)', async () => {
    mockCashfreeGateway.capturePayment.mockResolvedValue({ paymentId: 'cf_pay_123', status: 'captured', raw: {} })

    await service.capturePayment('cf_pay_123', 500000, 'INR', 'cashfree')

    expect(mockCashfreeGateway.capturePayment).toHaveBeenCalledWith('cf_pay_123', 500000, 'INR')
    expect(mockRazorpayGateway.capturePayment).not.toHaveBeenCalled()
  })

  it('should route initiateRefund to Razorpay for pre-cutover Razorpay transactions', async () => {
    // Pre-cutover booking: stored with provider='razorpay'
    mockPaymentTxRepo.findByGatewayPaymentId.mockResolvedValue({
      id: 'ptx-1',
      provider: 'razorpay',
      gatewayPaymentId: 'pay_rzp_123',
      gatewayRefundId: null,
      status: 'CAPTURED',
    })
    mockPaymentTxRepo.updateStatus.mockResolvedValue({})

    await service.initiateRefund('pay_rzp_123', 500000, { reason: 'cancellation' }, 'razorpay')

    expect(mockRazorpayGateway.initiateRefund).toHaveBeenCalled()
    expect(mockCashfreeGateway.initiateRefund).not.toHaveBeenCalled()
  })

  it('should use active gateway (Cashfree) for createOrder after cutover', async () => {
    mockCashfreeGateway.createOrder.mockResolvedValue({
      orderId: 'cf_order_new',
      status: 'created',
      clientPayload: { provider: 'cashfree', orderId: 'cf_order_new', paymentSessionId: 'ps_abc' },
      raw: {},
    })

    const result = await service.createOrder({
      amountPaise: 500000,
      receipt: 'booking-new',
      notes: {},
    })

    expect(mockCashfreeGateway.createOrder).toHaveBeenCalled()
    expect(mockRazorpayGateway.createOrder).not.toHaveBeenCalled()
    expect(result.clientPayload.provider).toBe('cashfree')
  })

  it('should fall back to active gateway (Cashfree) when provider is unrecognized', async () => {
    // Graceful fallback: unrecognized provider routes to active gateway rather than crashing.
    // This guards against stale tx.provider values from before a gateway rename.
    mockCashfreeGateway.capturePayment.mockResolvedValue({ paymentId: 'pay_unknown', status: 'captured', raw: {} })

    await service.capturePayment('pay_unknown', 500000, 'INR', 'unknown' as any)

    expect(mockCashfreeGateway.capturePayment).toHaveBeenCalled()
    expect(mockRazorpayGateway.capturePayment).not.toHaveBeenCalled()
  })
})
