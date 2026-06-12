import { describe, it, expect } from 'vitest'
import { getBookingConflictKind } from '../booking-errors'
import type { AppApiError } from '../api-client'

/** Builds an error shaped like what the api-client response interceptor rejects with */
function makeApiError(message: string, code?: string, status = 409, subCode?: string): AppApiError {
  const err = new Error(message) as AppApiError
  err.code = code
  err.subCode = subCode
  err.status = status
  return err
}

describe('getBookingConflictKind', () => {
  // ── Primary path: sub-code based (stable API contract) ──

  it('classifies SEAT_CONFLICT sub-code as seat-conflict', () => {
    const err = makeApiError('One or more selected seats are no longer available', 'CONFLICT', 409, 'SEAT_CONFLICT')
    expect(getBookingConflictKind(err)).toBe('seat-conflict')
  })

  it('classifies ALREADY_BOOKED sub-code as already-booked', () => {
    const err = makeApiError('You already have a confirmed booking for this trip', 'CONFLICT', 409, 'ALREADY_BOOKED')
    expect(getBookingConflictKind(err)).toBe('already-booked')
  })

  it('returns "other" for an unrecognised sub-code', () => {
    const err = makeApiError('Not enough seats available', 'CONFLICT', 409, 'CAPACITY_FULL')
    expect(getBookingConflictKind(err)).toBe('other')
  })

  // ── Fallback path: message-based (backward compat with pre-subCode API) ──

  it('falls back to message matching for seat conflicts without sub-code', () => {
    const err = makeApiError('One or more selected seats are no longer available', 'CONFLICT')
    expect(getBookingConflictKind(err)).toBe('seat-conflict')
  })

  it('falls back to message matching for duplicate bookings without sub-code', () => {
    const err = makeApiError('You already have a confirmed booking for this trip', 'CONFLICT')
    expect(getBookingConflictKind(err)).toBe('already-booked')
  })

  it('does not classify the legacy capacity-full message without sub-code as seat-conflict', () => {
    const err = makeApiError('Not enough seats available — trip may be full', 'CONFLICT')
    expect(getBookingConflictKind(err)).toBe('other')
  })

  it('returns "other" for an unrecognised CONFLICT message without sub-code', () => {
    const err = makeApiError('Some new conflict variant', 'CONFLICT')
    expect(getBookingConflictKind(err)).toBe('other')
  })

  // ── Non-conflict errors ──

  it('returns "none" for non-CONFLICT API errors', () => {
    const err = makeApiError('Booking deadline has passed', 'VALIDATION_ERROR', 400)
    expect(getBookingConflictKind(err)).toBe('none')
  })

  it('returns "none" for plain errors without an API shape', () => {
    expect(getBookingConflictKind(new Error('Network down'))).toBe('none')
    expect(getBookingConflictKind(undefined)).toBe('none')
    expect(getBookingConflictKind('string error')).toBe('none')
  })
})
