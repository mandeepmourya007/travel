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

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/v1/auth',
}
