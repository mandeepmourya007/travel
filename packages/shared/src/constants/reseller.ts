/** Sort options for reseller/organizer/admin leads list endpoints. */
export const RESELLER_LEAD_SORTS = ['newest', 'oldest', 'bookings_desc', 'markup_desc'] as const
export type ResellerLeadSort = (typeof RESELLER_LEAD_SORTS)[number]

/** Object form for dot-access: RESELLER_LEAD_SORT.NEWEST — derived from array to stay in sync */
export const RESELLER_LEAD_SORT = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  BOOKINGS_DESC: 'bookings_desc',
  MARKUP_DESC: 'markup_desc',
} as const satisfies Record<string, ResellerLeadSort>

/** Rupees, per person — mirrors the sane upper bound enforced on create/patch sublink. */
export const RESELLER_MAX_MARKUP_AMOUNT = 100_000

/**
 * Refund progress shown on a reseller booking row — derived server-side from
 * `bookingStatus` + whether a REFUND-type PaymentTransaction exists (see
 * `ResellerRepository.mapBookingRow`). The frontend must never re-derive this.
 */
export const RESELLER_BOOKING_REFUND_STATUSES = ['PENDING', 'REFUNDED'] as const
export type ResellerBookingRefundStatus = (typeof RESELLER_BOOKING_REFUND_STATUSES)[number]

/** Object form for dot-access: RESELLER_BOOKING_REFUND_STATUS.PENDING — derived from array */
export const RESELLER_BOOKING_REFUND_STATUS = Object.fromEntries(
  RESELLER_BOOKING_REFUND_STATUSES.map((s) => [s, s]),
) as { readonly [K in ResellerBookingRefundStatus]: K }
