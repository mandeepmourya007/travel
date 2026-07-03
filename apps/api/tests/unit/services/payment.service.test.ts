import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentService } from '../../../src/services/payment.service'
import { PaymentError, AuthError } from '../../../src/errors/app-error'
import { NORMALIZED_EVENT_TYPE } from '../../../src/types/payment.types'
import type { NormalizedWebhookEvent, NormalizedOrder, NormalizedPayment } from '../../../src/types/payment.types'

// ── Mock Gateway (IPaymentGateway) ──────────────────────
const mockGateway = {
  provider: 'razorpay' as const,
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

const gatewayRegistry = new Map([['razorpay' as const, mockGateway]])

// ── Mock Repositories ──────────────────────────────────
const mockPaymentTxRepo = {
  create: vi.fn(),
  findByBookingId: vi.fn(),
  findInitiatedRefundByBookingId: vi.fn(),
  findByGatewayOrderId: vi.fn(),
  findByGatewayPaymentId: vi.fn(),
  findByRazorpayOrderId: vi.fn(),
  findByRazorpayPaymentId: vi.fn(),
  updateStatus: vi.fn(),
  updatePaymentId: vi.fn(),
}

const mockWebhookEventRepo = {
  create: vi.fn(),
  findBySourceAndEventId: vi.fn(),
  upsertBySourceAndEventId: vi.fn(),
  findByReference: vi.fn(),
  findByExternalId: vi.fn(),
  updateStatus: vi.fn(),
  incrementAttempts: vi.fn(),
  findFailedEvents: vi.fn(),
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

// ── Test Data Factories ─────────────────────────────────

function createNormalizedOrder(overrides: Partial<NormalizedOrder> = {}): NormalizedOrder {
  return {
    orderId: 'order_test123',
    status: 'created',
    clientPayload: {
      provider: 'razorpay',
      orderId: 'order_test123',
      razorpayKeyId: 'rzp_test_key',
    },
    raw: {},
    ...overrides,
  }
}

function createNormalizedPayment(overrides: Partial<NormalizedPayment> = {}): NormalizedPayment {
  return {
    paymentId: 'pay_test456',
    status: 'captured',
    raw: {},
    ...overrides,
  }
}

function createMockPaymentTx(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ptx-1',
    bookingId: 'booking-1',
    type: 'PAYMENT',
    amount: 5000,
    provider: 'razorpay',
    gatewayOrderId: 'order_test123',
    gatewayPaymentId: null,
    razorpayOrderId: 'order_test123',
    razorpayPaymentId: null,
    status: 'INITIATED',
    ...overrides,
  }
}

function createNormalizedEvent(
  type: NormalizedWebhookEvent['type'],
  overrides: Partial<NormalizedWebhookEvent> = {},
): NormalizedWebhookEvent {
  return {
    type,
    externalEventId: 'evt_test123',
    orderId: 'order_test123',
    paymentId: 'pay_test456',
    refundId: null,
    failureReason: null,
    mode: 'test',
    rawEventName: type,
    payload: {},
    ...overrides,
  }
}

let service: PaymentService

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service = new PaymentService(mockGateway as any, gatewayRegistry as any, mockPaymentTxRepo as any, mockWebhookEventRepo as any, mockLogger as any)
})

describe('PaymentService', () => {
  // ═══════════════════════════════════════════════════
  // createOrder — delegates to active gateway
  // ═══════════════════════════════════════════════════
  describe('createOrder', () => {
    it('should delegate to gateway.createOrder and return NormalizedOrder', async () => {
      const normalized = createNormalizedOrder()
      mockGateway.createOrder.mockResolvedValue(normalized)

      const result = await service.createOrder({ amountPaise: 500000, receipt: 'booking-1', notes: { tripId: 'trip-1' } })

      expect(mockGateway.createOrder).toHaveBeenCalledWith({
        amountPaise: 500000,
        receipt: 'booking-1',
        notes: { tripId: 'trip-1' },
      })
      expect(result.orderId).toBe('order_test123')
    })

    it('should re-throw PaymentError from gateway unchanged', async () => {
      mockGateway.createOrder.mockRejectedValue(new PaymentError('Failed to create Razorpay order'))

      await expect(
        service.createOrder({ amountPaise: 500000, receipt: 'booking-1', notes: {} }),
      ).rejects.toThrow('Failed to create Razorpay order')
    })

    it('should wrap unknown errors from gateway in PaymentError', async () => {
      const underlying = new Error('connect ETIMEDOUT api.razorpay.com:443')
      mockGateway.createOrder.mockRejectedValue(underlying)

      const err = await service.createOrder({ amountPaise: 500000, receipt: 'booking-1', notes: {} }).catch((e) => e)

      expect(err).toBeInstanceOf(PaymentError)
      expect(err.cause).toBe(underlying)
    })
  })

  // ═══════════════════════════════════════════════════
  // capturePayment — routes to gateway by provider
  // ═══════════════════════════════════════════════════
  describe('capturePayment', () => {
    it('should delegate to gateway.capturePayment', async () => {
      mockGateway.capturePayment.mockResolvedValue(createNormalizedPayment())

      const result = await service.capturePayment('pay_test456', 500000, 'INR')

      expect(mockGateway.capturePayment).toHaveBeenCalledWith('pay_test456', 500000, 'INR')
      expect(result.paymentId).toBe('pay_test456')
    })

    it('should route to the registry gateway when provider is specified', async () => {
      mockGateway.capturePayment.mockResolvedValue(createNormalizedPayment())

      await service.capturePayment('pay_test456', 500000, 'INR', 'razorpay')

      expect(mockGateway.capturePayment).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // verifyClientCallback
  // ═══════════════════════════════════════════════════
  describe('verifyClientCallback', () => {
    it('should return true for a valid callback via the gateway', async () => {
      mockGateway.verifyClientCallback.mockReturnValue(true)

      const result = await service.verifyClientCallback({
        orderId: 'order_test123',
        paymentId: 'pay_test456',
        signature: 'valid_sig',
      })

      expect(result).toBe(true)
      expect(mockGateway.verifyClientCallback).toHaveBeenCalledWith({
        orderId: 'order_test123',
        paymentId: 'pay_test456',
        signature: 'valid_sig',
      })
    })

    it('should return false for an invalid callback', async () => {
      mockGateway.verifyClientCallback.mockReturnValue(false)

      const result = await service.verifyClientCallback({
        orderId: 'order_test123',
        paymentId: 'pay_test456',
        signature: 'bad_sig',
      })

      expect(result).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════
  // handleWebhook — verify + record + return normalized
  // ═══════════════════════════════════════════════════
  describe('handleWebhook', () => {
    const rawBody = Buffer.from('{}')
    const headers = { 'x-razorpay-signature': 'sig', 'x-razorpay-event-id': 'evt_test123' }

    it('should record webhook event and return webhookEventId + normalized', async () => {
      const normalized = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
      mockGateway.verifyAndParseWebhook.mockReturnValue(normalized)
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(createMockPaymentTx())
      mockWebhookEventRepo.upsertBySourceAndEventId.mockResolvedValue({ id: 'whe-1', attempts: 1 })

      const result = await service.handleWebhook(rawBody, headers, 'razorpay')

      expect(result).not.toBeNull()
      expect(result!.webhookEventId).toBe('whe-1')
      expect(result!.normalized).toMatchObject({ type: NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED })
      expect(mockWebhookEventRepo.upsertBySourceAndEventId).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'RAZORPAY',
          externalEventId: 'evt_test123',
          status: 'RECEIVED',
        }),
      )
    })

    it('should return { webhookEventId: null, normalized } for duplicate events (attempts > 1)', async () => {
      const normalized = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
      mockGateway.verifyAndParseWebhook.mockReturnValue(normalized)
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(null)
      mockWebhookEventRepo.upsertBySourceAndEventId.mockResolvedValue({ id: 'whe-existing', attempts: 2 })

      const result = await service.handleWebhook(rawBody, headers, 'razorpay')

      expect(result).not.toBeNull()
      expect(result!.webhookEventId).toBeNull()
    })

    it('should throw AuthError when gateway.verifyAndParseWebhook throws AuthError', async () => {
      mockGateway.verifyAndParseWebhook.mockImplementation(() => {
        throw new AuthError('Invalid signature')
      })

      await expect(
        service.handleWebhook(rawBody, headers, 'razorpay'),
      ).rejects.toThrow('Invalid signature')
    })

    it('should resolve internal reference from order → booking lookup', async () => {
      const normalized = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
      mockGateway.verifyAndParseWebhook.mockReturnValue(normalized)
      const paymentTx = createMockPaymentTx({ bookingId: 'booking-99' })
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)
      mockWebhookEventRepo.upsertBySourceAndEventId.mockResolvedValue({ id: 'whe-1', attempts: 1 })

      await service.handleWebhook(rawBody, headers, 'razorpay')

      expect(mockWebhookEventRepo.upsertBySourceAndEventId).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceModel: 'Booking',
          referenceId: 'booking-99',
        }),
      )
    })
  })

  // ═══════════════════════════════════════════════════
  // processWebhookEvent
  // ═══════════════════════════════════════════════════
  describe('processWebhookEvent', () => {
    it('should process PAYMENT_AUTHORIZED event and update status to COMPLETED', async () => {
      const normalized = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
      const webhookEvent = {
        id: 'whe-1',
        eventType: 'payment.authorized',
        payload: normalized,
        normalizedType: NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED,
        status: 'RECEIVED',
      }
      mockWebhookEventRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(createMockPaymentTx())
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.processWebhookEvent(webhookEvent as any)

      expect(mockWebhookEventRepo.updateStatus).toHaveBeenCalledWith('whe-1', 'PROCESSING', undefined)
    })

    it('should mark event as SKIPPED for unknown event types', async () => {
      const webhookEvent = {
        id: 'whe-1',
        eventType: 'unknown.event',
        payload: { type: 'UNKNOWN', orderId: null, paymentId: null },
        normalizedType: NORMALIZED_EVENT_TYPE.UNKNOWN,
        status: 'RECEIVED',
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.processWebhookEvent(webhookEvent as any)

      expect(mockWebhookEventRepo.updateStatus).toHaveBeenCalledWith(
        'whe-1', 'SKIPPED', expect.objectContaining({ failureReason: expect.any(String) }),
      )
    })

    it('should mark event as FAILED when processing throws error', async () => {
      const normalized = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
      const webhookEvent = {
        id: 'whe-1',
        eventType: 'payment.authorized',
        payload: normalized,
        normalizedType: NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED,
        status: 'RECEIVED',
      }
      mockWebhookEventRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.findByGatewayOrderId.mockRejectedValue(new Error('DB error'))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await service.processWebhookEvent(webhookEvent as any)

      expect(mockWebhookEventRepo.updateStatus).toHaveBeenCalledWith(
        'whe-1', 'FAILED', expect.objectContaining({ failureReason: 'DB error' }),
      )
    })
  })

  // ═══════════════════════════════════════════════════
  // handlePaymentAuthorized
  // ═══════════════════════════════════════════════════
  describe('handlePaymentAuthorized', () => {
    it('should update payment transaction to AUTHORIZED', async () => {
      const paymentTx = createMockPaymentTx()
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
      await service.handlePaymentAuthorized(event)

      expect(mockPaymentTxRepo.updatePaymentId).toHaveBeenCalledWith('ptx-1', 'pay_test456')
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'AUTHORIZED')
    })

    it('should skip if payment transaction not found (orphan webhook)', async () => {
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(null)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
      await service.handlePaymentAuthorized(event)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should skip when tx is already CAPTURED (out-of-order delivery guard)', async () => {
      const paymentTx = createMockPaymentTx({ status: 'CAPTURED' })
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED)
      await service.handlePaymentAuthorized(event)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // handlePaymentCaptured
  // ═══════════════════════════════════════════════════
  describe('handlePaymentCaptured', () => {
    it('should update payment transaction to CAPTURED with resolved provider', async () => {
      const paymentTx = createMockPaymentTx({ status: 'AUTHORIZED', provider: 'razorpay' })
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})
      mockGateway.fetchTransferId.mockResolvedValue(null) // fire-and-forget stub

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED)
      await service.handlePaymentCaptured(event)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'CAPTURED', { provider: 'razorpay' })
    })

    it('should backfill provider=cashfree when tx.provider is null and orderId starts with booking-', async () => {
      const paymentTx = createMockPaymentTx({
        status: 'AUTHORIZED',
        provider: null,
        gatewayOrderId: 'booking-1234567890',
        razorpayOrderId: 'booking-1234567890',
      })
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})
      mockGateway.fetchTransferId.mockResolvedValue(null)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED)
      await service.handlePaymentCaptured(event)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'CAPTURED', { provider: 'cashfree' })
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ paymentTxId: 'ptx-1', resolvedProvider: 'cashfree' }),
        'Backfilling missing provider on CAPTURED tx',
      )
    })

    it('should skip if payment transaction not found', async () => {
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(null)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED)
      await service.handlePaymentCaptured(event)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })

    it('should skip update when transaction is already REFUNDED (out-of-order webhook)', async () => {
      const paymentTx = createMockPaymentTx({ status: 'REFUNDED' })
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_CAPTURED)
      await service.handlePaymentCaptured(event)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // handleOrderPaid
  // ═══════════════════════════════════════════════════
  describe('handleOrderPaid', () => {
    it('should update payment transaction to CAPTURED with resolved provider', async () => {
      const paymentTx = createMockPaymentTx({ status: 'AUTHORIZED', provider: 'razorpay' })
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.ORDER_PAID)
      await service.handleOrderPaid(event)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'CAPTURED', { provider: 'razorpay' })
    })

    it('should backfill provider=cashfree when tx.provider is null and order is Cashfree format', async () => {
      const paymentTx = createMockPaymentTx({
        status: 'AUTHORIZED',
        provider: null,
        gatewayOrderId: 'booking-9876543210',
        razorpayOrderId: 'booking-9876543210',
      })
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.ORDER_PAID)
      await service.handleOrderPaid(event)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'CAPTURED', { provider: 'cashfree' })
    })

    it('should skip if payment transaction not found', async () => {
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(null)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.ORDER_PAID)
      await service.handleOrderPaid(event)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // handlePaymentFailed (C2 fix — DON'T expire booking)
  // ═══════════════════════════════════════════════════
  describe('handlePaymentFailed', () => {
    it('should log failure but NOT expire booking (UPI retry possible)', async () => {
      const paymentTx = createMockPaymentTx()
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_FAILED, {
        failureReason: 'Payment failed',
      })
      await service.handlePaymentFailed(event)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-1', 'FAILED',
        expect.objectContaining({ failureReason: expect.any(String) }),
      )
      expect(mockLogger.info).toHaveBeenCalled()
    })

    it('should skip if payment transaction not found', async () => {
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(null)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_FAILED)
      await service.handlePaymentFailed(event)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })

    it('should skip when tx is already CAPTURED (successful retry after failed event)', async () => {
      const paymentTx = createMockPaymentTx({ status: 'CAPTURED' })
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.PAYMENT_FAILED)
      await service.handlePaymentFailed(event)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // handleRefundProcessed
  // ═══════════════════════════════════════════════════
  describe('handleRefundProcessed', () => {
    it('should mark PAYMENT tx and REFUND tx as REFUNDED', async () => {
      const paymentTx = createMockPaymentTx({
        status: 'CAPTURED',
        gatewayPaymentId: 'pay_test456',
        bookingId: 'booking-1',
      })
      const refundTx = { id: 'ptx-refund-1', bookingId: 'booking-1', type: 'REFUND', status: 'INITIATED' }
      mockPaymentTxRepo.findByGatewayPaymentId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.findInitiatedRefundByBookingId.mockResolvedValue(refundTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.REFUND_PROCESSED, {
        paymentId: 'pay_test456',
        refundId: 'rfnd_test789',
      })
      await service.handleRefundProcessed(event)

      // PAYMENT tx marked REFUNDED (ledger record)
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-1', 'REFUNDED',
        expect.objectContaining({ gatewayRefundId: 'rfnd_test789' }),
      )
      // REFUND tx also marked REFUNDED (audit trail)
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-refund-1', 'REFUNDED',
        expect.objectContaining({ gatewayRefundId: 'rfnd_test789' }),
      )
    })

    it('should log warning if payment transaction not found', async () => {
      mockPaymentTxRepo.findByGatewayPaymentId.mockResolvedValue(null)
      // orderId fallback also returns null — both lookup strategies fail
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(null)

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.REFUND_PROCESSED, {
        paymentId: 'pay_unknown',
        refundId: 'rfnd_test789',
      })
      await service.handleRefundProcessed(event)

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should still mark PAYMENT tx REFUNDED when no INITIATED REFUND tx found (external refund)', async () => {
      const paymentTx = createMockPaymentTx({
        status: 'CAPTURED',
        gatewayPaymentId: 'pay_test456',
        bookingId: 'booking-1',
      })
      mockPaymentTxRepo.findByGatewayPaymentId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.findInitiatedRefundByBookingId.mockResolvedValue(null)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.REFUND_PROCESSED, {
        paymentId: 'pay_test456',
        refundId: 'rfnd_ext',
      })
      await service.handleRefundProcessed(event)

      // PAYMENT tx still marked REFUNDED for ledger accuracy
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-1', 'REFUNDED',
        expect.objectContaining({ gatewayRefundId: 'rfnd_ext' }),
      )
      // Only one updateStatus call — no REFUND tx to update
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledTimes(1)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should return early when both paymentId and orderId are missing (no lookup key)', async () => {
      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.REFUND_PROCESSED, { paymentId: null, orderId: null })
      await service.handleRefundProcessed(event)

      expect(mockPaymentTxRepo.findByGatewayPaymentId).not.toHaveBeenCalled()
      expect(mockPaymentTxRepo.findByGatewayOrderId).not.toHaveBeenCalled()
    })

    it('should use orderId fallback when paymentId is null (Cashfree REFUND_STATUS_WEBHOOK)', async () => {
      const paymentTx = createMockPaymentTx({
        status: 'CAPTURED',
        gatewayPaymentId: 'pay_cf_456',
        bookingId: 'booking-1',
      })
      const refundTx = { id: 'ptx-refund-1', bookingId: 'booking-1', type: 'REFUND', status: 'INITIATED' }
      // paymentId is null — orderId fallback kicks in
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.findInitiatedRefundByBookingId.mockResolvedValue(refundTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})

      const event = createNormalizedEvent(NORMALIZED_EVENT_TYPE.REFUND_PROCESSED, {
        paymentId: null,
        orderId: 'order_cf_123',
        refundId: 'rfnd_cf_789',
      })
      await service.handleRefundProcessed(event)

      // findByGatewayPaymentId NOT called — paymentId is null
      expect(mockPaymentTxRepo.findByGatewayPaymentId).not.toHaveBeenCalled()
      // Fell back to orderId lookup
      expect(mockPaymentTxRepo.findByGatewayOrderId).toHaveBeenCalledWith('order_cf_123')
      // Both PAYMENT tx and REFUND tx marked REFUNDED
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-1', 'REFUNDED',
        expect.objectContaining({ gatewayRefundId: 'rfnd_cf_789' }),
      )
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-refund-1', 'REFUNDED',
        expect.objectContaining({ gatewayRefundId: 'rfnd_cf_789' }),
      )
    })
  })

  // ═══════════════════════════════════════════════════
  // resolveBookingIdFromOrder
  // ═══════════════════════════════════════════════════
  describe('resolveBookingIdFromOrder', () => {
    it('should return bookingId from matching payment transaction', async () => {
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(createMockPaymentTx({ bookingId: 'booking-42' }))

      const result = await service.resolveBookingIdFromOrder('order_test123')

      expect(result).toBe('booking-42')
    })

    it('should return null when no transaction found', async () => {
      mockPaymentTxRepo.findByGatewayOrderId.mockResolvedValue(null)

      const result = await service.resolveBookingIdFromOrder('order_unknown')

      expect(result).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════
  // resolveProviderFromTx — single source of truth for provider routing
  // ═══════════════════════════════════════════════════
  describe('resolveProviderFromTx', () => {
    it('should return stored provider when it matches a registered gateway', () => {
      // gatewayRegistry only has 'razorpay'; stored='razorpay' matches
      const result = service.resolveProviderFromTx({ provider: 'razorpay', gatewayOrderId: 'order_abc' })

      expect(result).toBe('razorpay')
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should infer cashfree from booking- order ID when provider is null', () => {
      const result = service.resolveProviderFromTx({ provider: null, gatewayOrderId: 'booking-1234567890' })

      expect(result).toBe('cashfree')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'booking-1234567890' }),
        'provider not set on tx — inferred cashfree from order ID format',
      )
    })

    it('should fall back to razorpayOrderId when gatewayOrderId is null', () => {
      const result = service.resolveProviderFromTx({
        provider: null,
        gatewayOrderId: null,
        razorpayOrderId: 'booking-9999999999',
      })

      expect(result).toBe('cashfree')
    })

    it('should default to razorpay when provider is null and orderId starts with order_', () => {
      const result = service.resolveProviderFromTx({ provider: null, gatewayOrderId: 'order_abc123' })

      expect(result).toBe('razorpay')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order_abc123' }),
        'provider not set and cannot infer from order ID — defaulting to razorpay',
      )
    })

    it('should default to razorpay when provider and orderId are both null', () => {
      const result = service.resolveProviderFromTx({ provider: null, gatewayOrderId: null, razorpayOrderId: null })

      expect(result).toBe('razorpay')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: null }),
        'provider not set and cannot infer from order ID — defaulting to razorpay',
      )
    })

    it('should warn and infer from order ID when stored provider is not in registry (gateway removed after cutover)', () => {
      // 'cashfree' is NOT in gatewayRegistry (only razorpay is) — simulates removed gateway
      const result = service.resolveProviderFromTx({ provider: 'cashfree', gatewayOrderId: 'booking-111' })

      // Falls through to order ID inference since gateways.has('cashfree') === false
      expect(result).toBe('cashfree')
    })
  })
})
