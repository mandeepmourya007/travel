import type { CancellationPolicy } from '../types/trip.types'
import { CANCELLATION_POLICY } from '../constants/trip-types'

/**
 * Refund percent based on cancellation policy and hours until trip start.
 *
 * FLEXIBLE  : >=48h → 100%, <48h → 50%
 * MODERATE  : >=48h →  50%, <48h →  0%
 * STRICT    : always 0%
 *
 * Single source of truth — used by both the API service and the web UI estimate.
 */
export function calculateRefundPercent(policy: CancellationPolicy, hoursUntilTrip: number): number {
  switch (policy) {
    case CANCELLATION_POLICY.FLEXIBLE: return hoursUntilTrip >= 48 ? 100 : 50
    case CANCELLATION_POLICY.MODERATE: return hoursUntilTrip >= 48 ? 50 : 0
    default: return 0
  }
}

/**
 * Estimates refund amount (rupees, rounded) for a given booking.
 * Accepts `now` so callers can pass a fixed timestamp for deterministic testing.
 * Returns `{ percent: 0, amount: 0 }` when `tripStartDate` is absent.
 */
export function estimateRefund(
  totalAmount: number,
  cancellationPolicy: CancellationPolicy,
  tripStartDate: Date | string | null | undefined,
  now: number = Date.now(),
): { percent: number; amount: number } {
  if (!tripStartDate) return { percent: 0, amount: 0 }
  const hoursUntilTrip = (new Date(tripStartDate).getTime() - now) / (1000 * 60 * 60)
  const percent = calculateRefundPercent(cancellationPolicy, hoursUntilTrip)
  return { percent, amount: Math.round((totalAmount * percent) / 100) }
}
