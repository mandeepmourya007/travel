import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { PaymentService } from '../../../src/services/payment.service'

// ── Mock Dependencies ──────────────────────────────
const mockRazorpay = {
  orders: { create: vi.fn(), fetch: vi.fn() },
  payments: { capture: vi.fn(), fetch: vi.fn(), refund: vi.fn() },
}

const mockPaymentTxRepo = {
  create: vi.fn(),
  findByBookingId: vi.fn(),
  findByRazorpayOrderId: vi.fn(),
  findByRazorpayPaymentId: vi.fn(),
  updateStatus: vi.fn(),
  updatePaymentId: vi.fn(),
}

const mockWebhookEventRepo = {
  create: vi.fn(),
  findBySourceAndEventId: vi.fn(),
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

// ── Test Constants ──────────────────────────────────
const WEBHOOK_SECRET = 'test-webhook-secret'
const KEY_SECRET = 'test-key-secret'

// ── Test Data Factories ─────────────────────────────

function createMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_test123',
    entity: 'order',
    amount: 500000,
    amount_paid: 0,
    amount_due: 500000,
    currency: 'INR',
    receipt: 'booking-1',
    status: 'created',
    ...overrides,
  }
}

function createMockPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_test456',
    entity: 'payment',
    amount: 500000,
    currency: 'INR',
    status: 'authorized',
    order_id: 'order_test123',
    method: 'upi',
    ...overrides,
  }
}

function createMockPaymentTx(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ptx-1',
    bookingId: 'booking-1',
    type: 'PAYMENT',
    amount: 5000,
    currency: 'INR',
    razorpayOrderId: 'order_test123',
    razorpayPaymentId: null,
    status: 'INITIATED',
    ...overrides,
  }
}

function createWebhookPayload(event: string, paymentOverrides: Record<string, unknown> = {}) {
  return {
    entity: 'event',
    account_id: 'acc_test',
    event,
    contains: ['payment'],
    payload: {
      payment: {
        entity: createMockPayment(paymentOverrides),
      },
    },
  }
}

function createOrderPaidPayload(overrides: Record<string, unknown> = {}) {
  return {
    entity: 'event',
    account_id: 'acc_test',
    event: 'order.paid',
    contains: ['payment', 'order'],
    payload: {
      payment: { entity: createMockPayment() },
      order: { entity: createMockOrder({ status: 'paid', ...overrides }) },
    },
  }
}

let service: PaymentService

beforeEach(() => {
  vi.clearAllMocks()
  service = new PaymentService(
    mockRazorpay as any,
    mockPaymentTxRepo as any,
    mockWebhookEventRepo as any,
    KEY_SECRET,
    WEBHOOK_SECRET,
    mockLogger as any,
  )
})

describe('PaymentService', () => {
  // ═══════════════════════════════════════════════════
  // createOrder
  // ═══════════════════════════════════════════════════
  describe('createOrder', () => {
    it('should create a Razorpay order with manual capture and transfers', async () => {
      const mockOrder = createMockOrder()
      mockRazorpay.orders.create.mockResolvedValue(mockOrder)

      const transfers = [{
        account: 'acc_org123',
        amount: 450000,
        currency: 'INR',
        on_hold: 1,
        on_hold_until: Math.floor(Date.now() / 1000) + 86400,
        notes: { bookingId: 'booking-1' },
      }]

      const result = await service.createOrder(500000, 'booking-1', transfers, { tripId: 'trip-1' })

      expect(mockRazorpay.orders.create).toHaveBeenCalledWith({
        amount: 500000,
        currency: 'INR',
        receipt: 'booking-1',
        payment_capture: 0,
        transfers,
        notes: { tripId: 'trip-1' },
      })
      expect(result).toEqual(mockOrder)
    })

    it('should throw PaymentError when Razorpay API fails', async () => {
      mockRazorpay.orders.create.mockRejectedValue(new Error('Razorpay down'))

      await expect(
        service.createOrder(500000, 'booking-1', [], {}),
      ).rejects.toThrow('Failed to create Razorpay order')
    })

    it('should throw ValidationError when amount is zero', async () => {
      await expect(
        service.createOrder(0, 'booking-1', [], {}),
      ).rejects.toThrow()
    })
  })

  // ═══════════════════════════════════════════════════
  // capturePayment
  // ═══════════════════════════════════════════════════
  describe('capturePayment', () => {
    it('should capture payment with exact authorized amount', async () => {
      const capturedPayment = createMockPayment({ status: 'captured' })
      mockRazorpay.payments.capture.mockResolvedValue(capturedPayment)

      const result = await service.capturePayment('pay_test456', 500000, 'INR')

      expect(mockRazorpay.payments.capture).toHaveBeenCalledWith('pay_test456', 500000, 'INR')
      expect(result).toEqual(capturedPayment)
    })

    it('should return existing capture when payment already captured (idempotent)', async () => {
      const alreadyCaptured = createMockPayment({ status: 'captured' })
      const razorpayError = new Error('This payment has already been captured')
      Object.assign(razorpayError, { statusCode: 400, error: { code: 'BAD_REQUEST_ERROR' } })
      mockRazorpay.payments.capture.mockRejectedValue(razorpayError)
      mockRazorpay.payments.fetch.mockResolvedValue(alreadyCaptured)

      const result = await service.capturePayment('pay_test456', 500000, 'INR')

      expect(result).toEqual(alreadyCaptured)
    })

    it('should throw PaymentError when capture fails', async () => {
      mockRazorpay.payments.capture.mockRejectedValue(new Error('Capture failed'))

      await expect(
        service.capturePayment('pay_test456', 500000, 'INR'),
      ).rejects.toThrow('Failed to capture payment')
    })
  })

  // ═══════════════════════════════════════════════════
  // verifySignature
  // ═══════════════════════════════════════════════════
  describe('verifySignature', () => {
    it('should return true for valid HMAC-SHA256 signature', () => {
      const orderId = 'order_test123'
      const paymentId = 'pay_test456'
      const expectedSig = crypto
        .createHmac('sha256', KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex')

      const result = service.verifySignature(orderId, paymentId, expectedSig)

      expect(result).toBe(true)
    })

    it('should return false for invalid signature', () => {
      const result = service.verifySignature('order_test123', 'pay_test456', 'invalid-sig')

      expect(result).toBe(false)
    })

    it('should return false for tampered orderId', () => {
      const expectedSig = crypto
        .createHmac('sha256', KEY_SECRET)
        .update('order_test123|pay_test456')
        .digest('hex')

      const result = service.verifySignature('order_tampered', 'pay_test456', expectedSig)

      expect(result).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════
  // checkOrderStatus
  // ═══════════════════════════════════════════════════
  describe('checkOrderStatus', () => {
    it('should return order status when order exists', async () => {
      mockRazorpay.orders.fetch.mockResolvedValue(createMockOrder({ status: 'paid' }))

      const result = await service.checkOrderStatus('order_test123')

      expect(result).toBe('paid')
      expect(mockRazorpay.orders.fetch).toHaveBeenCalledWith('order_test123')
    })

    it('should return created status for pending order', async () => {
      mockRazorpay.orders.fetch.mockResolvedValue(createMockOrder({ status: 'created' }))

      const result = await service.checkOrderStatus('order_test123')

      expect(result).toBe('created')
    })

    it('should throw PaymentError when order not found', async () => {
      mockRazorpay.orders.fetch.mockRejectedValue(new Error('Order not found'))

      await expect(
        service.checkOrderStatus('order_nonexistent'),
      ).rejects.toThrow('Failed to check order status')
    })
  })

  // ═══════════════════════════════════════════════════
  // initiateRefund
  // ═══════════════════════════════════════════════════
  describe('initiateRefund', () => {
    it('should create refund with reverse_all for Route transfer reversal', async () => {
      const mockRefund = { id: 'rfnd_test789', amount: 500000, status: 'processed' }
      mockRazorpay.payments.refund.mockResolvedValue(mockRefund)

      const result = await service.initiateRefund('pay_test456', 500000, { bookingId: 'booking-1' })

      expect(mockRazorpay.payments.refund).toHaveBeenCalledWith('pay_test456', {
        amount: 500000,
        reverse_all: 1,
        notes: { bookingId: 'booking-1' },
      })
      expect(result).toEqual(mockRefund)
    })

    it('should support partial refund amount', async () => {
      const mockRefund = { id: 'rfnd_test789', amount: 250000, status: 'processed' }
      mockRazorpay.payments.refund.mockResolvedValue(mockRefund)

      const result = await service.initiateRefund('pay_test456', 250000)

      expect(mockRazorpay.payments.refund).toHaveBeenCalledWith('pay_test456', {
        amount: 250000,
        reverse_all: 1,
        notes: undefined,
      })
      expect(result.amount).toBe(250000)
    })

    it('should throw PaymentError when refund fails', async () => {
      mockRazorpay.payments.refund.mockRejectedValue(new Error('Refund failed'))

      await expect(
        service.initiateRefund('pay_test456', 500000),
      ).rejects.toThrow('Failed to initiate refund')
    })
  })

  // ═══════════════════════════════════════════════════
  // handleWebhook
  // ═══════════════════════════════════════════════════
  describe('handleWebhook', () => {
    const validPayload = createWebhookPayload('payment.authorized')
    const rawBody = Buffer.from(JSON.stringify(validPayload))
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
    const headers = {
      'x-razorpay-signature': signature,
      'x-razorpay-event-id': 'evt_test123',
    }

    it('should record webhook event and return its ID for async processing', async () => {
      mockWebhookEventRepo.findBySourceAndEventId.mockResolvedValue(null)
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(createMockPaymentTx())
      mockWebhookEventRepo.create.mockResolvedValue({ id: 'whe-1' })

      const result = await service.handleWebhook(rawBody, headers)

      expect(result).toBe('whe-1')
      expect(mockWebhookEventRepo.findBySourceAndEventId).toHaveBeenCalledWith('RAZORPAY', 'evt_test123')
      expect(mockWebhookEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'RAZORPAY',
          externalEventId: 'evt_test123',
          eventType: 'payment.authorized',
          status: 'RECEIVED',
        }),
      )
    })

    it('should skip duplicate event and increment attempts', async () => {
      mockWebhookEventRepo.findBySourceAndEventId.mockResolvedValue({
        id: 'whe-existing',
        attempts: 1,
      })

      const result = await service.handleWebhook(rawBody, headers)

      expect(result).toBeNull()
      expect(mockWebhookEventRepo.incrementAttempts).toHaveBeenCalledWith('whe-existing')
      expect(mockWebhookEventRepo.create).not.toHaveBeenCalled()
    })

    it('should resolve internal reference from order → booking lookup', async () => {
      const paymentTx = createMockPaymentTx({ bookingId: 'booking-99' })
      mockWebhookEventRepo.findBySourceAndEventId.mockResolvedValue(null)
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(paymentTx)
      mockWebhookEventRepo.create.mockResolvedValue({ id: 'whe-1' })

      await service.handleWebhook(rawBody, headers)

      expect(mockWebhookEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceModel: 'Booking',
          referenceId: 'booking-99',
        }),
      )
    })

    it('should handle missing x-razorpay-event-id header gracefully', async () => {
      const headersWithoutEventId = { 'x-razorpay-signature': signature }

      await expect(
        service.handleWebhook(rawBody, headersWithoutEventId),
      ).rejects.toThrow()
    })
  })

  // ═══════════════════════════════════════════════════
  // processWebhookEvent
  // ═══════════════════════════════════════════════════
  describe('processWebhookEvent', () => {
    it('should process payment.authorized event and update status to COMPLETED', async () => {
      const webhookEvent = {
        id: 'whe-1',
        eventType: 'payment.authorized',
        payload: createWebhookPayload('payment.authorized'),
        status: 'RECEIVED',
      }
      mockWebhookEventRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(createMockPaymentTx())
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      // We need to provide the event data to process
      await service.processWebhookEvent(webhookEvent as any)

      expect(mockWebhookEventRepo.updateStatus).toHaveBeenCalledWith(
        'whe-1', 'PROCESSING', undefined,
      )
    })

    it('should mark event as SKIPPED for unknown event types', async () => {
      const webhookEvent = {
        id: 'whe-1',
        eventType: 'unknown.event',
        payload: { event: 'unknown.event', payload: {} },
        status: 'RECEIVED',
      }

      await service.processWebhookEvent(webhookEvent as any)

      expect(mockWebhookEventRepo.updateStatus).toHaveBeenCalledWith(
        'whe-1', 'SKIPPED', expect.objectContaining({ failureReason: expect.any(String) }),
      )
    })

    it('should mark event as FAILED when processing throws error', async () => {
      const webhookEvent = {
        id: 'whe-1',
        eventType: 'payment.authorized',
        payload: createWebhookPayload('payment.authorized'),
        status: 'RECEIVED',
      }
      mockWebhookEventRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.findByRazorpayOrderId.mockRejectedValue(new Error('DB error'))

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
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      const payload = createWebhookPayload('payment.authorized').payload

      await service.handlePaymentAuthorized(payload)

      expect(mockPaymentTxRepo.updatePaymentId).toHaveBeenCalledWith('ptx-1', 'pay_test456')
      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'AUTHORIZED')
    })

    it('should skip if payment transaction not found (orphan webhook)', async () => {
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(null)

      const payload = createWebhookPayload('payment.authorized').payload

      await service.handlePaymentAuthorized(payload)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should handle payment that is already captured in entity status (M3 fix)', async () => {
      const paymentTx = createMockPaymentTx()
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      const payload = {
        payment: { entity: createMockPayment({ status: 'captured' }) },
      }

      await service.handlePaymentAuthorized(payload)

      // Should still update — let confirmBooking handle the idempotency
      expect(mockPaymentTxRepo.updatePaymentId).toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // handlePaymentCaptured
  // ═══════════════════════════════════════════════════
  describe('handlePaymentCaptured', () => {
    it('should update payment transaction to CAPTURED', async () => {
      const paymentTx = createMockPaymentTx({ status: 'AUTHORIZED' })
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      const payload = createWebhookPayload('payment.captured', { status: 'captured' }).payload

      await service.handlePaymentCaptured(payload)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'CAPTURED')
    })

    it('should skip if payment transaction not found', async () => {
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(null)

      const payload = createWebhookPayload('payment.captured', { status: 'captured' }).payload

      await service.handlePaymentCaptured(payload)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // handleOrderPaid
  // ═══════════════════════════════════════════════════
  describe('handleOrderPaid', () => {
    it('should update payment transaction to CAPTURED for paid order', async () => {
      const paymentTx = createMockPaymentTx({ status: 'AUTHORIZED' })
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})
      mockPaymentTxRepo.updatePaymentId.mockResolvedValue({})

      const payload = createOrderPaidPayload().payload

      await service.handleOrderPaid(payload)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith('ptx-1', 'CAPTURED')
    })

    it('should skip if payment transaction not found', async () => {
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(null)

      const payload = createOrderPaidPayload().payload

      await service.handleOrderPaid(payload)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // handlePaymentFailed (C2 fix — DON'T expire booking)
  // ═══════════════════════════════════════════════════
  describe('handlePaymentFailed', () => {
    it('should log failure but NOT update booking status (UPI retry possible)', async () => {
      const paymentTx = createMockPaymentTx()
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})

      const payload = createWebhookPayload('payment.failed', {
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Payment failed',
      }).payload

      await service.handlePaymentFailed(payload)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-1', 'FAILED',
        expect.objectContaining({ failureReason: expect.any(String) }),
      )
      expect(mockLogger.info).toHaveBeenCalled()
    })

    it('should skip if payment transaction not found', async () => {
      mockPaymentTxRepo.findByRazorpayOrderId.mockResolvedValue(null)

      const payload = createWebhookPayload('payment.failed', { status: 'failed' }).payload

      await service.handlePaymentFailed(payload)

      expect(mockPaymentTxRepo.updateStatus).not.toHaveBeenCalled()
    })
  })

  // ═══════════════════════════════════════════════════
  // handleRefundProcessed
  // ═══════════════════════════════════════════════════
  describe('handleRefundProcessed', () => {
    it('should update payment transaction to REFUNDED', async () => {
      const paymentTx = createMockPaymentTx({
        status: 'CAPTURED',
        razorpayPaymentId: 'pay_test456',
      })
      mockPaymentTxRepo.findByRazorpayPaymentId.mockResolvedValue(paymentTx)
      mockPaymentTxRepo.updateStatus.mockResolvedValue({})

      const payload = {
        refund: {
          entity: {
            id: 'rfnd_test789',
            payment_id: 'pay_test456',
            amount: 500000,
            status: 'processed',
          },
        },
        payment: { entity: createMockPayment({ status: 'refunded' }) },
      }

      await service.handleRefundProcessed(payload)

      expect(mockPaymentTxRepo.updateStatus).toHaveBeenCalledWith(
        'ptx-1', 'REFUNDED',
        expect.objectContaining({ razorpayRefundId: 'rfnd_test789' }),
      )
    })

    it('should log warning if payment transaction not found', async () => {
      mockPaymentTxRepo.findByRazorpayPaymentId.mockResolvedValue(null)

      const payload = {
        refund: { entity: { id: 'rfnd_test789', payment_id: 'pay_unknown' } },
        payment: { entity: createMockPayment() },
      }

      await service.handleRefundProcessed(payload)

      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })
})
