import { isAppApiError } from '@/lib/api-client'

/**
 * Distinguishes the CONFLICT (409) sub-types the backend throws during
 * booking creation, so the UI can react correctly:
 *
 * - `'seat-conflict'`   — subCode SEAT_CONFLICT (seats grabbed by another user)
 * - `'already-booked'`  — subCode ALREADY_BOOKED (duplicate booking attempt)
 * - `'other'`           — any other CONFLICT (e.g. CAPACITY_FULL)
 * - `'none'`            — not a CONFLICT error at all
 *
 * Primary: branches on `error.subCode` (stable API contract).
 * Fallback: message-text matching for backward compat with pre-subCode API responses.
 */
export type BookingConflictKind = 'seat-conflict' | 'already-booked' | 'other' | 'none'

export function getBookingConflictKind(err: unknown): BookingConflictKind {
  if (!isAppApiError(err) || err.code !== 'CONFLICT') return 'none'

  // Prefer structured sub-code (stable API contract)
  if (err.subCode === 'SEAT_CONFLICT') return 'seat-conflict'
  if (err.subCode === 'ALREADY_BOOKED') return 'already-booked'
  if (err.subCode) return 'other'

  // Fallback: message-based matching for backward compatibility.
  // Capacity-full first: the legacy CAPACITY_FULL message contains 'seat'
  // ('Not enough seats available — trip may be full') and must not match seat-conflict.
  const message = err.message.toLowerCase()
  if (message.includes('full') || message.includes('not enough')) return 'other'
  if (message.includes('seat')) return 'seat-conflict'
  if (message.includes('already')) return 'already-booked'
  return 'other'
}
