/** Sort direction values used across filters, validators, and repositories. */
export const SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const

export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER]

/** Tuple consumed by z.enum() — keeps validators DRY. */
export const SORT_ORDERS = [SORT_ORDER.ASC, SORT_ORDER.DESC] as const

/** Common sort field keys shared across multiple domains. */
export const SORT_FIELD = {
  CREATED_AT: 'createdAt',
  STATUS: 'status',
  AMOUNT: 'amount',
} as const
