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

/** Sort fields available on the admin booking table. */
export const ADMIN_BOOKING_SORT_BY = {
  TOTAL_AMOUNT: 'totalAmount',
  BOOKING_STATUS: 'bookingStatus',
  CREATED_AT: 'createdAt',
} as const

export type AdminBookingSortBy = (typeof ADMIN_BOOKING_SORT_BY)[keyof typeof ADMIN_BOOKING_SORT_BY]

/** Tuple for z.enum() — keeps adminBookingFiltersSchema DRY. */
export const ADMIN_BOOKING_SORT_BYS = [
  ADMIN_BOOKING_SORT_BY.TOTAL_AMOUNT,
  ADMIN_BOOKING_SORT_BY.BOOKING_STATUS,
  ADMIN_BOOKING_SORT_BY.CREATED_AT,
] as const

/** Sort fields available on the admin trip table. */
export const ADMIN_TRIP_SORT_BY = {
  DESTINATION: 'destination',
  START_DATE: 'startDate',
  PRICE_PER_PERSON: 'pricePerPerson',
  STATUS: 'status',
} as const

export type AdminTripSortBy = (typeof ADMIN_TRIP_SORT_BY)[keyof typeof ADMIN_TRIP_SORT_BY]

/** Tuple for z.enum() — keeps adminTripFiltersSchema DRY. */
export const ADMIN_TRIP_SORT_BYS = [
  ADMIN_TRIP_SORT_BY.DESTINATION,
  ADMIN_TRIP_SORT_BY.START_DATE,
  ADMIN_TRIP_SORT_BY.PRICE_PER_PERSON,
  ADMIN_TRIP_SORT_BY.STATUS,
] as const
