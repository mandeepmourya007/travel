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
