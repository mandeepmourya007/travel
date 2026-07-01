/**
 * Gateway-internal status vocabularies — backend only (FE never sees these).
 *
 * NORMALIZED_PAYMENT_STATUS: provider-neutral lowercase vocab (Razorpay-derived).
 * CASHFREE_PAYMENT_STATUS:   raw Cashfree payment_status / order_status strings.
 * RAZORPAY_PAYMENT_STATUS:   raw Razorpay payment status strings.
 */

/** Provider-neutral normalized payment status vocabulary (Razorpay-derived). */
export const NORMALIZED_PAYMENT_STATUS = {
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const
export type NormalizedPaymentStatus =
  (typeof NORMALIZED_PAYMENT_STATUS)[keyof typeof NORMALIZED_PAYMENT_STATUS]

/** Raw Cashfree external payment_status / order_status strings. */
export const CASHFREE_PAYMENT_STATUS = {
  SUCCESS: 'SUCCESS',
  AUTHORIZED: 'AUTHORIZED',
  PAID: 'PAID',
  FAILED: 'FAILED',
} as const

/** Raw Razorpay payment status strings. */
export const RAZORPAY_PAYMENT_STATUS = {
  CAPTURED: 'captured',
  AUTHORIZED: 'authorized',
} as const
