/** @deprecated Use DB-driven TripCategory instead. Kept only for seeding and test fallbacks. */
export const DEFAULT_TRIP_TYPES = [
  'ADVENTURE',
  'WEEKEND',
  'TREKKING',
  'BEACH',
  'CULTURAL',
  'ROAD_TRIP',
] as const

/** @deprecated Alias for backward compat — prefer DEFAULT_TRIP_TYPES */
export const TRIP_TYPES = DEFAULT_TRIP_TYPES

export const BOOKING_MODES = ['INSTANT', 'REQUEST_BASED'] as const

/** Feature flag: temporarily disable the REQUEST_BASED booking mode.
 *  Flip to `true` to re-enable request-based trips everywhere. */
export const REQUEST_BASED_BOOKING_ENABLED = false

type BookingModeConst = (typeof BOOKING_MODES)[number]
/** Object form for dot-access: BOOKING_MODE.REQUEST_BASED — derived from array */
export const BOOKING_MODE = Object.fromEntries(
  BOOKING_MODES.map((s) => [s, s]),
) as { readonly [K in BookingModeConst]: K }

export const CANCELLATION_POLICIES = ['FLEXIBLE', 'MODERATE', 'STRICT'] as const

type CancellationPolicyConst = (typeof CANCELLATION_POLICIES)[number]
/** Object form for dot-access: CANCELLATION_POLICY.FLEXIBLE — derived from array */
export const CANCELLATION_POLICY = Object.fromEntries(
  CANCELLATION_POLICIES.map((s) => [s, s]),
) as { readonly [K in CancellationPolicyConst]: K }

/** Transfer point type constants */
export const TRANSFER_POINT_TYPE = {
  PICKUP: 'PICKUP',
  DROP: 'DROP',
} as const

export const TRIP_STATUSES = ['DRAFT', 'ACTIVE', 'FULL', 'COMPLETED', 'CANCELLED'] as const

export type TripStatusConst = (typeof TRIP_STATUSES)[number]
/** Object form for dot-access: TRIP_STATUS.COMPLETED — derived from array */
export const TRIP_STATUS = Object.fromEntries(
  TRIP_STATUSES.map((s) => [s, s]),
) as { readonly [K in TripStatusConst]: K }
