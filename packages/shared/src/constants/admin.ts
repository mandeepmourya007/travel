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

/** Sort fields available on the admin traveller directory table. */
export const ADMIN_TRAVELLER_SORT = {
  NAME: 'name',
  BOOKINGS_COUNT: 'bookingsCount',
  JOINED_AT: 'joinedAt',
} as const

export type AdminTravellerSort = (typeof ADMIN_TRAVELLER_SORT)[keyof typeof ADMIN_TRAVELLER_SORT]

/** Tuple for z.enum() — keeps adminTravellerFiltersSchema DRY. */
export const ADMIN_TRAVELLER_SORTS = [
  ADMIN_TRAVELLER_SORT.NAME,
  ADMIN_TRAVELLER_SORT.BOOKINGS_COUNT,
  ADMIN_TRAVELLER_SORT.JOINED_AT,
] as const

/** Status filter for the admin traveller directory — maps to User.isActive. */
export const ADMIN_TRAVELLER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const

export type AdminTravellerStatus = (typeof ADMIN_TRAVELLER_STATUS)[keyof typeof ADMIN_TRAVELLER_STATUS]

/** Tuple for z.enum() — keeps adminTravellerFiltersSchema DRY. */
export const ADMIN_TRAVELLER_STATUSES = [
  ADMIN_TRAVELLER_STATUS.ACTIVE,
  ADMIN_TRAVELLER_STATUS.INACTIVE,
] as const

/** Sort fields available on the admin organizer directory table. */
export const ADMIN_ORGANIZER_SORT = {
  NAME: 'name',
  TRIPS_COUNT: 'tripsCount',
  JOINED_AT: 'joinedAt',
} as const

export type AdminOrganizerSort = (typeof ADMIN_ORGANIZER_SORT)[keyof typeof ADMIN_ORGANIZER_SORT]

/** Tuple for z.enum() — keeps adminOrganizerDirectoryFiltersSchema DRY. */
export const ADMIN_ORGANIZER_SORTS = [
  ADMIN_ORGANIZER_SORT.NAME,
  ADMIN_ORGANIZER_SORT.TRIPS_COUNT,
  ADMIN_ORGANIZER_SORT.JOINED_AT,
] as const
