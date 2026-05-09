export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'REFUNDED',
] as const
export type BookingStatusConst = (typeof BOOKING_STATUSES)[number]

export const TRIP_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED',
] as const
export type TripRequestStatusConst = (typeof TRIP_REQUEST_STATUSES)[number]
