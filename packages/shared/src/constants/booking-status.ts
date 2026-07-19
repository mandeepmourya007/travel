export const BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'REFUNDED',
  'EXPIRED',
] as const
export type BookingStatusConst = (typeof BOOKING_STATUSES)[number]

/** Object form for dot-access: BOOKING_STATUS.CONFIRMED — derived from array to stay in sync */
export const BOOKING_STATUS = Object.fromEntries(
  BOOKING_STATUSES.map((s) => [s, s]),
) as { readonly [K in BookingStatusConst]: K }

export const TRIP_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED',
] as const
export type TripRequestStatusConst = (typeof TRIP_REQUEST_STATUSES)[number]

/** Object form for dot-access: TRIP_REQUEST_STATUS.APPROVED — derived from array to stay in sync */
export const TRIP_REQUEST_STATUS = Object.fromEntries(
  TRIP_REQUEST_STATUSES.map((s) => [s, s]),
) as { readonly [K in TripRequestStatusConst]: K }

/** Sort options for the organizer's trip-participants ("bookings for a trip") list. */
export const TRIP_BOOKING_SORTS = ['newest', 'oldest', 'amount_desc', 'amount_asc'] as const
export type TripBookingSort = (typeof TRIP_BOOKING_SORTS)[number]

/** Object form for dot-access: TRIP_BOOKING_SORT.NEWEST — kept in sync with TRIP_BOOKING_SORTS by hand */
export const TRIP_BOOKING_SORT = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  AMOUNT_DESC: 'amount_desc',
  AMOUNT_ASC: 'amount_asc',
} as const satisfies Record<string, TripBookingSort>

/** Tab filter values for the traveler-facing "My Bookings" page. */
export const MY_BOOKINGS_TABS = ['all', 'upcoming', 'payment_pending', 'completed', 'cancelled'] as const
export type MyBookingTabConst = (typeof MY_BOOKINGS_TABS)[number]

/** Object form for dot-access: MY_BOOKINGS_TAB.UPCOMING — kept in sync with MY_BOOKINGS_TABS by hand */
export const MY_BOOKINGS_TAB = {
  ALL: 'all',
  UPCOMING: 'upcoming',
  PAYMENT_PENDING: 'payment_pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const satisfies Record<string, MyBookingTabConst>
