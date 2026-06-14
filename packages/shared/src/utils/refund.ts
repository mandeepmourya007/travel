/**
 * Refund percent based on cancellation policy and hours until trip start.
 *
 * FLEXIBLE  : >=48h → 100%, <48h → 50%
 * MODERATE  : >=48h →  50%, <48h →  0%
 * STRICT    : always 0%
 *
 * Single source of truth — used by both the API service and the web UI estimate.
 */
export function calculateRefundPercent(policy: string, hoursUntilTrip: number): number {
  switch (policy) {
    case 'FLEXIBLE': return hoursUntilTrip >= 48 ? 100 : 50
    case 'MODERATE': return hoursUntilTrip >= 48 ? 50 : 0
    default: return 0
  }
}

/**
 * Estimates refund amount (rupees, rounded) for a given booking.
 * Accepts `now` so callers can pass a fixed timestamp for deterministic testing.
 */
export function estimateRefund(
  totalAmount: number,
  cancellationPolicy: string,
  tripStartDate: Date | string,
  now: number = Date.now(),
): { percent: number; amount: number } {
  const hoursUntilTrip = (new Date(tripStartDate).getTime() - now) / (1000 * 60 * 60)
  const percent = calculateRefundPercent(cancellationPolicy, hoursUntilTrip)
  return { percent, amount: Math.round((totalAmount * percent) / 100) }
}
