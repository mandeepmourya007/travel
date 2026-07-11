/**
 * Provider-neutral payment types used across the gateway abstraction.
 * Gateways map their proprietary shapes into these; PaymentService operates only on these.
 */

import { PAYMENT_PROVIDERS } from '@shared/constants'

// ─── Provider Identifier ──────────────────────────────
// Single source of truth: PAYMENT_PROVIDERS array in packages/shared/src/constants/payment.ts
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

// ─── Normalized Event Types ───────────────────────────
export const NORMALIZED_EVENT_TYPE = {
  PAYMENT_AUTHORIZED: 'PAYMENT_AUTHORIZED',
  PAYMENT_CAPTURED: 'PAYMENT_CAPTURED',
  ORDER_PAID: 'ORDER_PAID',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  REFUND_PROCESSED: 'REFUND_PROCESSED',
  UNKNOWN: 'UNKNOWN',
} as const

export type NormalizedEventType = (typeof NORMALIZED_EVENT_TYPE)[keyof typeof NORMALIZED_EVENT_TYPE]

// ─── Gateway Order Params ─────────────────────────────

/**
 * Split payout params — both gateways accept these at order creation.
 * Razorpay: becomes transfers[] with on_hold + on_hold_until.
 * Cashfree: becomes order_splits[] with deferred settlement date.
 */
export interface SplitParams {
  /** Gateway-specific vendor/linked-account ID */
  vendorAccountId: string
  /** Organizer's share in paise (platform commission already deducted) */
  vendorAmountPaise: number
  /** Epoch seconds — when the hold should be released */
  holdUntilEpochSec: number
  notes?: Record<string, unknown>
}

export interface CreateOrderParams {
  /** Amount in paise (gateway converts to rupee-float internally if needed) */
  amountPaise: number
  receipt: string
  notes: Record<string, unknown>
  /**
   * Optional split payout. If null/undefined the full amount settles to the platform.
   * Razorpay: transfers[]; Cashfree: order_splits[]
   */
  split?: SplitParams | null
  /**
   * Customer details — required by Cashfree at order creation.
   * Razorpay ignores this field.
   */
  customer?: {
    id: string
    name?: string
    email?: string
    phone?: string
  }
  /**
   * Post-payment return URL — Cashfree only. Supports {order_id} placeholder.
   * Ignored by RazorpayGateway.
   */
  returnUrl?: string
}

// ─── Normalized Gateway Responses ────────────────────

export interface NormalizedOrder {
  /** Gateway-assigned order identifier — stored as gatewayOrderId */
  orderId: string
  /** Raw provider status string */
  status: string
  /**
   * Data the FE needs to launch checkout.
   * Razorpay: { razorpayKeyId, orderId }
   * Cashfree: { paymentSessionId }
   */
  clientPayload: RazorpayClientPayload | CashfreeClientPayload
  raw: unknown
}

export interface RazorpayClientPayload {
  provider: 'razorpay'
  orderId: string
  razorpayKeyId: string
}

export interface CashfreeClientPayload {
  provider: 'cashfree'
  orderId: string
  paymentSessionId: string
}

export interface NormalizedPayment {
  paymentId: string
  /** Normalized to Razorpay vocabulary: 'authorized' | 'captured' | 'failed' | 'refunded' */
  status: 'authorized' | 'captured' | 'failed' | 'refunded' | string
  raw: unknown
}

// ─── Normalized Webhook Event ─────────────────────────

/**
 * Provider-neutral webhook event shape.
 * PaymentService handlers consume only these fields — no provider-specific keys.
 */
export interface NormalizedWebhookEvent {
  type: NormalizedEventType
  /** Provider-supplied deduplication key (e.g. x-razorpay-event-id, or synthesized for Cashfree) */
  externalEventId: string
  orderId: string | null
  paymentId: string | null
  refundId: string | null
  failureReason: string | null
  mode: 'test' | 'live'
  /** Original provider event string — logged for SKIPPED events and debugging */
  rawEventName: string
  payload: unknown
}

// ─── Client Callback Verification ────────────────────

/**
 * Input for gateway.verifyClientCallback().
 * Razorpay: orderId + paymentId + signature (HMAC).
 * Cashfree: orderId only — verification is a server-side order-status fetch.
 */
export interface ClientCallbackInput {
  orderId: string
  paymentId?: string
  signature?: string
}

// ─── Payout Account Onboarding ───────────────────────

/**
 * Provider-neutral params for gateway.createPayoutAccount().
 * Razorpay: creates a Route linked account (POST /v2/accounts).
 * Cashfree: creates an Easy Split vendor (POST /easy-split/vendors).
 */
export interface CreatePayoutAccountParams {
  /** Organizer profile ID — used to derive a deterministic vendor_id (Cashfree) or as a reference */
  referenceId: string
  businessName: string
  contactName: string
  email: string
  phone: string | null
  /** Required for Cashfree vendor KYC and Razorpay Route linked-account legal_info.pan */
  pan?: string
  /** Required for Cashfree vendor KYC; ignored by Razorpay */
  accountType?: 'INDIVIDUAL' | 'BUSINESS'
  bank: {
    accountNumber: string
    ifsc: string
    beneficiaryName: string
  }
}

/**
 * Provider-neutral response from gateway.createPayoutAccount().
 * Callers persist accountId keyed by provider — no provider-specific field names leak out.
 */
export interface NormalizedPayoutAccount {
  /** razorpayAccountId (Razorpay) or cashfreeVendorId (Cashfree) */
  accountId: string
  provider: PaymentProvider
  /** Raw provider status string — informational only */
  status?: string
  raw?: unknown
}
