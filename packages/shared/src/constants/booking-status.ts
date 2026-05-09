export const BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'REFUNDED',
  'EXPIRED',
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
