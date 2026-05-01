export const TRIP_TYPES = [
  'ADVENTURE',
  'WEEKEND',
  'TREKKING',
  'BEACH',
  'CULTURAL',
  'ROAD_TRIP',
] as const

export const BOOKING_MODES = ['INSTANT', 'REQUEST_BASED'] as const

export const CANCELLATION_POLICIES = ['FLEXIBLE', 'MODERATE', 'STRICT'] as const

export const TRIP_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const
