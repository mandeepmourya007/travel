/* eslint-disable @typescript-eslint/no-explicit-any -- Dev-only mock: Razorpay SDK types are too strict for stubs */
import crypto from 'crypto'
import { Logger } from 'pino'
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository'
import { WebhookEventRepository } from '../repositories/webhook-event.repository'
import { PaymentService } from './payment.service'

const MOCK_KEY_SECRET = 'mock_dev_secret_do_not_use_in_production'

/**
 * Mock PaymentService for local development when Razorpay credentials are not configured.
 *
 * - createOrder → returns a fake order with `order_mock_*` ID
 * - capturePayment → returns a fake captured payment
 * - verifySignature → always returns true
 * - All webhook methods delegate to real (no-op since no real webhooks in dev)
 *
 * ⚠️ Only used when NODE_ENV !== 'production' and Razorpay is not configured.
 */
export class MockPaymentService extends PaymentService {
  private mockLogger: Logger

  constructor(
    paymentTxRepo: PaymentTransactionRepository,
    webhookEventRepo: WebhookEventRepository,
    logger: Logger,
  ) {
    // Create a minimal Razorpay-shaped stub to satisfy the parent constructor
    const razorpayStub = {
      orders: { create: () => Promise.resolve({}), fetch: () => Promise.resolve({}) },
      payments: {
        capture: () => Promise.resolve({}),
        fetch: () => Promise.resolve({}),
        refund: () => Promise.resolve({}),
      },
    } as any

    super(razorpayStub, paymentTxRepo, webhookEventRepo, MOCK_KEY_SECRET, '', logger)
    this.mockLogger = logger
  }

  override async createOrder(
    amount: number,
    receipt: string,
    _transfers: Record<string, unknown>[],
    notes: Record<string, unknown>,
  ) {
    const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`
    this.mockLogger.warn(
      { orderId, amount, receipt },
      '[MOCK] Razorpay order created — NOT a real payment',
    )
    return {
      id: orderId,
      entity: 'order',
      amount,
      amount_paid: 0,
      amount_due: amount,
      currency: 'INR',
      receipt,
      status: 'created',
      notes,
    } as any
  }

  override async capturePayment(paymentId: string, amount: number, currency = 'INR') {
    this.mockLogger.warn({ paymentId, amount }, '[MOCK] Payment captured — NOT a real capture')
    return {
      id: paymentId,
      entity: 'payment',
      amount,
      currency,
      status: 'captured',
    } as any
  }

  override verifySignature(_orderId: string, _paymentId: string, _signature: string): boolean {
    this.mockLogger.warn('[MOCK] Signature verification — always returns true in dev mode')
    return true
  }

  override async checkOrderStatus(_orderId: string): Promise<string> {
    return 'paid'
  }

  override async initiateRefund(paymentId: string, amount: number, _notes?: Record<string, unknown>) {
    this.mockLogger.warn({ paymentId, amount }, '[MOCK] Refund initiated — NOT a real refund')
    return {
      id: `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`,
      entity: 'refund',
      amount,
      payment_id: paymentId,
      status: 'processed',
    } as any
  }
}
