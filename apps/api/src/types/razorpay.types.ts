// ─── Razorpay Webhook Payload Types ──────────────────
// The Razorpay SDK doesn't export typed webhook payloads.
// These cover the fields we actually use in our webhook handlers.

/**
 * Minimal payment entity fields used in webhook handlers.
 * Razorpay sends more fields — we only type what we consume.
 */
export interface RazorpayPaymentEntity {
  id: string
  order_id: string
  status: 'authorized' | 'captured' | 'failed' | 'refunded'
  error_code?: string
  error_description?: string
}

/**
 * Minimal order entity fields used in order.paid webhook.
 */
export interface RazorpayOrderEntity {
  id: string
  status: 'created' | 'attempted' | 'paid'
}

/**
 * Minimal refund entity fields used in refund.processed webhook.
 */
export interface RazorpayRefundEntity {
  id: string
  payment_id: string
  amount: number
  status: 'processed' | 'failed'
}

/**
 * Shape of Razorpay webhook payloads after extracting .payload from the event.
 * Each handler receives the inner payload object.
 */
export interface RazorpayWebhookPayload {
  payment?: { entity: RazorpayPaymentEntity }
  order?: { entity: RazorpayOrderEntity }
  refund?: { entity: RazorpayRefundEntity }
}

/**
 * Stored webhook payload shape — may be the full event body (with nested .payload)
 * or already the inner payload. processWebhookEvent handles both.
 */
export interface RazorpayWebhookEventBody {
  payload?: RazorpayWebhookPayload
  [key: string]: unknown
}

/**
 * Webhook event as stored in our DB after initial parsing.
 * Used by processWebhookEvent to dispatch to handlers.
 */
export interface StoredWebhookEvent {
  id: string
  eventType: string
  /** Provider-neutral event type injected by WebhookController before dispatch */
  normalizedType?: string
  payload: RazorpayWebhookEventBody
}
