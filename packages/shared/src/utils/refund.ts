import type { CancellationPolicy } from '../types/trip.types'
import { CANCELLATION_POLICY } from '../constants/trip-types'
import { REFUND_CLIFF_DAYS, MAX_REFUND_PERCENT } from '../constants/payment'

/**
 * Refund percent based on cancellation policy and hours until trip start.
 *
 * Day-based cliff (replaces the old 48h/100-50-0 tiers): the refund window closes
 * REFUND_CLIFF_DAYS (7 days) before trip start. This cliff is deliberately aligned
 * with the organizer deposit/balance payout split in utils/payout.ts — the platform
 * only ever releases the organizer's non-refundable share (see ORGANIZER_DEPOSIT_PERCENT
 * in constants/payment.ts), so no refund issued under this policy can ever require a
 * clawback from the organizer.
 *
 * FLEXIBLE / MODERATE : >=7 days until trip → MAX_REFUND_PERCENT (50%); <7 days → 0%
 * STRICT               : always 0%, regardless of timing
 * Unrecognised policy  : 0% (fail-safe default — never over-refund on bad/missing data)
 *
 * Single source of truth — used by both the API service and the web UI estimate.
 */
export function calculateRefundPercent(policy: CancellationPolicy, hoursUntilTrip: number): number {
  switch (policy) {
    case CANCELLATION_POLICY.STRICT:
      return 0
    case CANCELLATION_POLICY.FLEXIBLE:
    case CANCELLATION_POLICY.MODERATE:
      return hoursUntilTrip >= REFUND_CLIFF_DAYS * 24 ? MAX_REFUND_PERCENT : 0
    default:
      return 0
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
