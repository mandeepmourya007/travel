import type { TripDetail } from '@shared/types/trip.types'

/**
 * Returns the effective price per person — early bird if active, otherwise regular.
 * Shared logic used by TravelerForm, PriceSummary, and booking page.
 */
export function getEffectivePrice(trip: Pick<TripDetail, 'earlyBirdPrice' | 'earlyBirdDeadline' | 'pricePerPerson'>): number {
  const isEarlyBird =
    trip.earlyBirdPrice &&
    trip.earlyBirdDeadline &&
    new Date(trip.earlyBirdDeadline) > new Date()

  return isEarlyBird ? trip.earlyBirdPrice! : trip.pricePerPerson
}

/**
 * Effective price per person including a reseller sublink's markup, if any.
 * Display-only — the server always recomputes the authoritative total from the
 * sublink token (or a prior SublinkAttribution) at booking time.
 */
export function getEffectivePriceWithMarkup(
  trip: Pick<TripDetail, 'earlyBirdPrice' | 'earlyBirdDeadline' | 'pricePerPerson'>,
  markupAmountPerPerson = 0,
): number {
  return getEffectivePrice(trip) + markupAmountPerPerson
}
