export const REVIEW_MAX_PHOTOS = 5
export const REVIEW_MAX_COMMENT_LENGTH = 2000
export const REVIEW_MAX_REPLY_LENGTH = 1000
export const REVIEW_EDIT_WINDOW_DAYS = 30

export const REVIEW_SORT = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  RATING_HIGH: 'rating_high',
  RATING_LOW: 'rating_low',
} as const

export type ReviewSort = (typeof REVIEW_SORT)[keyof typeof REVIEW_SORT]

/** Tuple for z.enum() — keeps validators DRY. */
export const REVIEW_SORTS = [
  REVIEW_SORT.NEWEST,
  REVIEW_SORT.OLDEST,
  REVIEW_SORT.RATING_HIGH,
  REVIEW_SORT.RATING_LOW,
] as const

/** Integer rating values in descending order — use to build select options. */
export const REVIEW_RATING_VALUES = [5, 4, 3, 2, 1] as const
