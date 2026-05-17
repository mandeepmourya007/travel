export const BOOKING_EXPIRY_MINUTES = 30

export const APPROVAL_EXPIRY_HOURS = 48

export const MAX_COMPARE_TRIPS = 3

export const MAX_PHOTOS_PER_TRIP = 8

export const MIN_PRICE_PER_PERSON = 100

export const MAX_GROUP_SIZE = 50

export const PLATFORM_COMMISSION_PERCENT = 10

export const SALT_ROUNDS = 12

export const JWT_ACCESS_EXPIRY = '15m'

export const JWT_REFRESH_EXPIRY = '7d'

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

// ─── Trip Lifecycle ──────────────────────────────────
export const ESCROW_SAFETY_BUFFER_DAYS = 90
export const TRIP_COMPLETION_BATCH_SIZE = 50

// ─── Vehicle / Seat ─────────────────────────────────
export const SEAT_HOLD_MINUTES = 30

// ─── Wallet ──────────────────────────────────────────
export const WALLET_CASHBACK_PERCENT = 5
export const WALLET_SIGNUP_BONUS = 0
export const WALLET_MAX_ADMIN_CREDIT = 50000
export const WALLET_MAX_ADMIN_DEBIT = 50000

/** Parse page/limit filters and return skip/take + a builder for the response pagination object. */
export function paginate(filters: { page?: number; limit?: number }) {
  const page = filters.page ?? PAGINATION_DEFAULTS.page
  const limit = filters.limit ?? PAGINATION_DEFAULTS.limit
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
export const PAYMENT_TX_TYPE = {
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
  ESCROW_RELEASE: 'ESCROW_RELEASE',
} as const

export const PAYMENT_TX_STATUS = {
  INITIATED: 'INITIATED',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
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
export const CACHE_TTL = {
  TRIP_SEARCH: 60,
  TRIP_DETAIL: 300,
  DESTINATION_LIST: 600,
  DESTINATION_DETAIL: 300,
  CATEGORIES: 600,
  ORGANIZER_PROFILE: 300,
} as const

/** Generic reference model constants for webhook events + payment transactions */
export const REFERENCE_MODEL = {
  BOOKING: 'Booking',
} as const

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
}
