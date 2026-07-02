import crypto from 'crypto'
import type { Logger } from 'pino'
import { CURRENCY } from '../../utils/constants'
import { NORMALIZED_EVENT_TYPE } from '../../types/payment.types'
import { PAYMENT_PROVIDER } from '@shared/constants'
import { NORMALIZED_PAYMENT_STATUS } from './payment.constants'
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

/**
 * Mock payment gateway for local development when no real gateway is configured.
 *
 * - createOrder → returns a fake order with `order_mock_*` ID
 * - capturePayment → returns a fake captured payment
 * - verifyClientCallback → always returns true
 * - verifyAndParseWebhook → always returns a fake authorized event (for manual testing)
 *
 * ⚠️ Only used when NODE_ENV !== 'production' and no real gateway is configured.
 */
export class MockPaymentGateway implements IPaymentGateway {
  readonly provider = PAYMENT_PROVIDER.RAZORPAY

  constructor(private logger: Logger) {}

  async createOrder(params: CreateOrderParams): Promise<NormalizedOrder> {
    const orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`
    this.logger.warn(
      { orderId, amountPaise: params.amountPaise, receipt: params.receipt },
      '[MOCK] Payment order created — NOT a real payment',
    )
    return {
      orderId,
      status: 'created',
      clientPayload: {
        provider: PAYMENT_PROVIDER.RAZORPAY,
        orderId,
        razorpayKeyId: 'rzp_mock_dev_key',
      },
      raw: { id: orderId, amount: params.amountPaise, currency: CURRENCY },
    }
  }

  async capturePayment(paymentId: string, _amountPaise: number): Promise<NormalizedPayment> {
    this.logger.warn({ paymentId }, '[MOCK] Payment captured')
    return { paymentId, status: NORMALIZED_PAYMENT_STATUS.CAPTURED, raw: {} }
  }

  verifyClientCallback(_input: ClientCallbackInput): boolean {
    this.logger.warn('[MOCK] verifyClientCallback always returns true')
    return true
  }

  async checkOrderStatus(orderId: string): Promise<string> {
    this.logger.warn({ orderId }, '[MOCK] checkOrderStatus returning "paid"')
    return 'paid'
  }

  async fetchPaymentIdForOrder(orderId: string): Promise<string | null> {
    return `pay_mock_${orderId}`
  }

  async initiateRefund(paymentId: string, amountPaise: number): Promise<{ refundId: string; raw: unknown }> {
    const refundId = `rfnd_mock_${crypto.randomBytes(6).toString('hex')}`
    this.logger.warn({ paymentId, amountPaise, refundId }, '[MOCK] Refund initiated')
    return { refundId, raw: {} }
  }

  async fetchTransferId(_paymentId: string): Promise<string | null> {
    return null
  }

  async releaseTransferHold(transferId: string): Promise<void> {
    this.logger.warn({ transferId }, '[MOCK] releaseTransferHold — no-op')
  }

  async createPayoutAccount(params: CreatePayoutAccountParams): Promise<NormalizedPayoutAccount> {
    const accountId = `mock_payout_${params.referenceId.slice(0, 8)}`
    this.logger.warn({ accountId }, '[MOCK] createPayoutAccount — NOT a real payout account')
    return { accountId, provider: this.provider, status: 'mock' }
  }

  verifyAndParseWebhook(
    rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
  ): NormalizedWebhookEvent {
    let eventName = 'payment.authorized'
    try {
      const body = JSON.parse(rawBody.toString()) as { event?: string }
      eventName = body.event ?? eventName
    } catch {
      // ignore parse errors in mock
    }

    return {
      type: NORMALIZED_EVENT_TYPE.PAYMENT_AUTHORIZED,
      externalEventId: `mock_${crypto.randomBytes(8).toString('hex')}`,
      orderId: null,
      paymentId: null,
      refundId: null,
      failureReason: null,
      mode: 'test',
      rawEventName: eventName,
      payload: {},
    }
  }
}
