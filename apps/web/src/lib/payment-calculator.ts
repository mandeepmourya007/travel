/**
 * Payment split calculator for organizer, traveler, and reseller amounts.
 * 
 * Formula:
 * Traveler pays = Organizer trip fee + (10% commission on organizer fee) + Reseller amount
 * 
 * Example (₹6,666 traveler payment, ₹67 reseller amount):
 * - Organizer trip fee: ₹6,599 (6,666 - 67)
 * - Platform commission (10% of fee): ₹660
 * - Organizer earnings (90% of fee): ₹5,939
 * - Reseller amount: ₹67
 * - Total: 6,599 + 67 = ₹6,666
 */

const PLATFORM_COMMISSION_PERCENT = 10

/**
 * Calculate the amount a traveler paid (gross booking amount).
 * @param grossAmount - Total amount paid by traveler
 * @returns Amount paid by traveler
 */
export function getTravelerPaidAmount(grossAmount: number): number {
  return grossAmount
}

/**
 * Calculate the organizer's trip fee (before commission).
 * Organizer fee = Traveler paid - Reseller amount
 * Then commission is 10% of this fee.
 * @param grossAmount - Total amount paid by traveler
 * @param resellerAmount - Amount paid to reseller (if any)
 * @returns Organizer's trip fee
 */
export function getOrganizerTripFee(grossAmount: number, resellerAmount: number = 0): number {
  return grossAmount - resellerAmount
}

/**
 * Calculate the amount an organizer will receive (trip fee without commission).
 * Reseller amount is already excluded from trip fee calculation.
 * @param grossAmount - Total amount paid by traveler
 * @param resellerAmount - Amount paid to reseller (if any)
 * @returns Net amount organizer receives (trip fee - 10% commission)
 */
export function getOrganizerEarnings(grossAmount: number, resellerAmount: number = 0): number {
  const tripFee = getOrganizerTripFee(grossAmount, resellerAmount)
  return Math.round(tripFee * (100 - PLATFORM_COMMISSION_PERCENT) / 100)
}

/**
 * Calculate the platform commission amount (10% of organizer trip fee).
 * @param grossAmount - Total amount paid by traveler
 * @param resellerAmount - Amount paid to reseller (if any)
 * @returns Commission amount kept by platform (10% of organizer fee)
 */
export function getPlatformCommission(grossAmount: number, resellerAmount: number = 0): number {
  const tripFee = getOrganizerTripFee(grossAmount, resellerAmount)
  return Math.round(tripFee * PLATFORM_COMMISSION_PERCENT / 100)
}

/**
 * Calculate the amount a reseller receives.
 * @param resellerAmount - Amount paid to reseller
 * @returns Amount reseller receives
 */
export function getResellerEarnings(resellerAmount: number): number {
  return resellerAmount
}

/**
 * Get complete payment breakdown for a booking.
 * 
 * @param grossAmount - Total amount paid by traveler
 * @param resellerAmount - Amount paid to reseller (default: 0)
 * @returns Object with all payment amounts
 * 
 * @example
 * getPaymentBreakdown(6666, 67)
 * // Returns:
 * // {
 * //   travelerPaid: 6666,
 * //   organizerTripFee: 6599,
 * //   organizerEarnings: 5939,
 * //   platformCommission: 660,
 * //   resellerEarnings: 67
 * // }
 */
export function getPaymentBreakdown(grossAmount: number, resellerAmount: number = 0) {
  const travelerPaid = getTravelerPaidAmount(grossAmount)
  const organizerTripFee = getOrganizerTripFee(grossAmount, resellerAmount)
  const organizerEarnings = getOrganizerEarnings(grossAmount, resellerAmount)
  const platformCommission = getPlatformCommission(grossAmount, resellerAmount)
  const resellerEarnings = getResellerEarnings(resellerAmount)

  return {
    travelerPaid,
    organizerTripFee,
    organizerEarnings,
    platformCommission,
    resellerEarnings,
  }
}
