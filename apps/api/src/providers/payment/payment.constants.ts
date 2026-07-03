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

// ─── Payout Account Constants ──────────────────────────

/** Cashfree Easy Split vendor ID prefix and construction config */
export const CF_VENDOR_ID_PREFIX = 'cf_vendor_'
/** Number of referenceId characters used when building a deterministic vendorId */
export const CF_VENDOR_ID_REF_LENGTH = 20
/** Placeholder phone sent to Cashfree when the organizer has no registered phone */
export const CF_FALLBACK_PHONE = '9999999999'

/** Cashfree API error codes for payout account operations */
export const CF_ERROR_CODE = {
  VENDOR_ALREADY_EXISTS: 'vendor_already_exists',
} as const

/** Razorpay non-production mock payout account ID prefix */
export const RZP_MOCK_ACCOUNT_PREFIX = 'acc_mock_'

/** Provider-neutral payout account error messages (used by AuthService) */
export const PAYOUT_ERROR = {
  GATEWAY_NOT_CONFIGURED: 'Payment gateway not configured',
  ALREADY_LINKED: 'Payout account is already linked',
} as const

// ─── Cashfree Easy Split Vendor Constants ───────────────

/** Cashfree Easy Split vendor creation endpoint */
export const CF_VENDORS_PATH = '/easy-split/vendors'

/** Vendor status sent on creation and returned on idempotent success */
export const CF_VENDOR_STATUS_ACTIVE = 'ACTIVE'

/**
 * Cashfree schedule_option values for vendor settlement cycles.
 * T1 = T+1 settlement at 11:00 AM (default, used for all organizers).
 * INSTANT = same-day instant settlement (IDs 8/9 per Cashfree docs).
 * @see https://www.cashfree.com/docs/api-reference/payments/latest/split/vendors/create
 */
export const CF_SCHEDULE_OPTION_T1 = 1
export const CF_SCHEDULE_OPTION_INSTANT = 8

/**
 * Cashfree kyc_details.business_type for this platform.
 * Cashfree requires a category from their fixed enum — all organizers on TripCompare
 * operate under travel & hospitality.
 */
export const CF_BUSINESS_TYPE = 'Travel and Hospitality'
