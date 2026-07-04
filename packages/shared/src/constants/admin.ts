/** Sort fields available on the admin review table. */
export const ADMIN_REVIEW_SORT_BY = {
  CREATED_AT: 'createdAt',
  OVERALL_RATING: 'overallRating',
  ORGANIZER_NAME: 'organizerName',
} as const

export type AdminReviewSortBy = (typeof ADMIN_REVIEW_SORT_BY)[keyof typeof ADMIN_REVIEW_SORT_BY]

/** Tuple for z.enum() — keeps adminReviewFiltersSchema DRY. */
export const ADMIN_REVIEW_SORT_BYS = [
  ADMIN_REVIEW_SORT_BY.CREATED_AT,
  ADMIN_REVIEW_SORT_BY.OVERALL_RATING,
  ADMIN_REVIEW_SORT_BY.ORGANIZER_NAME,
] as const
