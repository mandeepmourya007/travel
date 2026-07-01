export const BOOKING_EXPIRY_MINUTES = 60

// 60s covers Razorpay createOrder worst-case timeout (30s SDK default)
// + all DB operations inside the lock with comfortable headroom.
// Must always be > Razorpay SDK timeout to avoid lock-expiry races.
export const BOOKING_LOCK_TTL_MS = 60_000

export const APPROVAL_EXPIRY_HOURS = 48

export const MAX_COMPARE_TRIPS = 3

export const MAX_PHOTOS_PER_TRIP = 8

export const MIN_PRICE_PER_PERSON = 100

export const MAX_GROUP_SIZE = 50

export const PLATFORM_COMMISSION_PERCENT = 10

export const SALT_ROUNDS = 12

export const JWT_ACCESS_EXPIRY = '15m'

export const REFRESH_TOKEN_DAYS = 7

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 50,
} as const

export const OTP_LENGTH = 4
export const OTP_EXPIRY_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_SECONDS = 30
export const OTP_RATE_LIMIT_WINDOW_MINUTES = 10
export const OTP_RATE_LIMIT_MAX_SENDS = 3
export const DEV_OTP = '0000'

// ─── Trending Score ──────────────────────────────────
// Minimum precomputed score for a trip to display the "Trending" badge.
// Formula (BookingVelocityStrategy): (week_bookings × 10) + (month_bookings_8_to_30d × 2) + urgency(5).
// Threshold of 20 ≈ 2 confirmed bookings in the last 7 days.
export const TRENDING_SCORE_THRESHOLD = 20

// ─── Trip Lifecycle ──────────────────────────────────
export const ESCROW_SAFETY_BUFFER_DAYS = 90
export const TRIP_COMPLETION_BATCH_SIZE = 50

// ─── Sitemap ─────────────────────────────────────────
// Hard cap on trips returned for sitemap generation.
// Prevents loading 100k+ rows into memory on large datasets.
export const SITEMAP_MAX_TRIPS = 50_000

// ─── Vehicle / Seat ─────────────────────────────────
export const SEAT_HOLD_MINUTES = 10

// ─── Wallet ──────────────────────────────────────────
export const WALLET_CASHBACK_PERCENT = 5
export const WALLET_SIGNUP_BONUS = 0
export const WALLET_MAX_ADMIN_CREDIT = 50000
export const WALLET_MAX_ADMIN_DEBIT = 50000

// Auto-cashback on trip completion. Defaults to 0 (disabled) so existing
// deployments are unaffected until explicitly enabled via env/config.
// Amount = min(round(totalAmount * PCT / 100), CAP, totalAmount).
export const WALLET_AUTO_CASHBACK_PERCENT = Number(process.env.WALLET_AUTO_CASHBACK_PERCENT ?? 0)
export const WALLET_AUTO_CASHBACK_CAP = Number(process.env.WALLET_AUTO_CASHBACK_CAP ?? 0)

// Days before an expirable credit (cashback, promotional) is voided.
export const WALLET_CREDIT_EXPIRY_DAYS = Number(process.env.WALLET_CREDIT_EXPIRY_DAYS ?? 90)

// Days before expiry to send the advance-warning notification.
export const WALLET_EXPIRY_WARN_DAYS = 7

/** Parse page/limit filters and return skip/take + a builder for the response pagination object. */
export function paginate(filters: { page?: number; limit?: number }) {
  const page = filters.page ?? PAGINATION_DEFAULTS.page
  const limit = Math.min(filters.limit ?? PAGINATION_DEFAULTS.limit, PAGINATION_DEFAULTS.maxLimit)
  const skip = (page - 1) * limit
  return {
    skip,
    take: limit,
    meta: (total: number) => ({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }),
  }
}

// ─── Payment Transaction ─────────────────────────────
// Single source of truth: packages/shared/src/constants/payment.ts
// Alias re-exports preserve all existing call-site imports without any changes.
export { PAYMENT_TYPE as PAYMENT_TX_TYPE, PAYMENT_STATUS as PAYMENT_TX_STATUS } from '@shared/constants'

// ─── Razorpay Webhook Event Types ────────────────────
export const RAZORPAY_WEBHOOK_EVENT = {
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  ORDER_PAID: 'order.paid',
  PAYMENT_FAILED: 'payment.failed',
  REFUND_PROCESSED: 'refund.processed',
} as const

// ─── Booking Error Codes ──────────────────────────────
export const BOOKING_ERROR_CODE = {
  CONFIRM_RACE: 'CONFIRM_RACE',
  CAPACITY_FULL: 'CAPACITY_FULL',
} as const

// ─── Webhook Log Tags (for ops grep) ─────────────────
export const WEBHOOK_LOG_TAG = {
  BOOKING_CONFIRM_FAILED: 'BOOKING_CONFIRM_FAILED',
} as const

// ─── Normalized (Provider-Neutral) Webhook Event Types ───
// Re-exported from types/payment.types — constants.ts is the central import point
export { NORMALIZED_EVENT_TYPE } from '../types/payment.types'

// ─── Invite Token Types ───────────────────────────────
export const INVITE_TOKEN_TYPE = {
  ORGANIZER_INVITE: 'ORGANIZER_INVITE',
} as const

// ─── Webhook ─────────────────────────────────────────
export const WEBHOOK_STATUS = {
  RECEIVED: 'RECEIVED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const

export const WEBHOOK_SOURCE = {
  RAZORPAY: 'RAZORPAY',
} as const

export const RAZORPAY_ORDER_STATUS = {
  CREATED: 'created',
  ATTEMPTED: 'attempted',
  PAID: 'paid',
} as const

// ─── Misc ────────────────────────────────────────────
export const CURRENCY = 'INR'
export const RAZORPAY_MOCK_KEY = 'rzp_mock_dev_key'
export const DEFAULT_COMMISSION_RATE = 10.0
export const JWT_ACCESS_EXPIRY_SECONDS = 900

export const OTP_TYPE = {
  PHONE_OTP: 'PHONE_OTP',
  EMAIL_OTP: 'EMAIL_OTP',
} as const

export const CLOUDINARY_TRANSFORM = 'c_limit,w_1920,h_1080,q_auto,f_auto'
export const MESSAGE_PREVIEW_LENGTH = 100

// ─── Redis Cache TTLs (seconds) ────────────────────
// All public-read caches are safe to hold long because every mutation
// (create/update/delete/publish trip, update destination) calls
// invalidateTripCaches() / invalidateByPrefix() immediately — so the
// cache is never stale beyond the instant a change is saved.
export const CACHE_TTL = {
  // 5 min: trip list/search results. Mutation invalidation ensures freshness.
  // Previously 60s — caused the full 584ms Trip.findMany to fire every minute.
  TRIP_SEARCH: 300,
  // 10 min: individual trip detail pages. Invalidated by slug on any update.
  TRIP_DETAIL: 600,
  // 1 hour: destination list. Admin-only mutations; very low write frequency.
  DESTINATION_LIST: 3600,
  // 15 min: destination detail (includes a trips sub-list). Invalidated by
  // invalidateTripCaches() on every trip mutation (update, publish, delete,
  // toggle) and by invalidateByPrefix(allDestinations()) on destination admin ops.
  DESTINATION_DETAIL: 900,
  // 1 hour: trip categories. Changes only via admin panel; almost never.
  CATEGORIES: 3600,
  // 10 min: organizer public profile. Changed only on profile update.
  ORGANIZER_PROFILE: 600,
  // 2 min: organizer dashboard stats. Bookings update these; keep low but
  // avoid the per-booking DB hit on every dashboard refresh.
  ORGANIZER_STATS: 120,
} as const

/** Generic reference model constants for webhook events + payment transactions */
export const REFERENCE_MODEL = {
  BOOKING: 'Booking',
} as const

// Both the frontend (safarnama.store) and the API are served under the same domain —
// the Next.js app proxies /api/* to the Render backend (see next.config.js rewrites).
// Same-domain means the browser treats all requests as same-site, so SameSite=Lax works
// without any cross-origin cookie workarounds.
// Lax is preferred over Strict: Strict blocks the cookie even on top-level navigations from
// other sites (e.g. clicking a link from Google), which would show the user as logged-out
// until the hydration refresh completes — a noticeable UX flicker.
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
}

// clearCookie must echo the same Secure + SameSite + path used at set-time;
// mismatched attributes cause browsers to silently ignore the clear.
export const CLEAR_COOKIE_OPTIONS = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
}
