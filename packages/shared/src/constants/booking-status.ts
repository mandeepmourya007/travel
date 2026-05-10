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
