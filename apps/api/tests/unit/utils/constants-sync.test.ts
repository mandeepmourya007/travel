import { describe, it, expect } from 'vitest'
import {
  BOOKING_STATUSES, BOOKING_STATUS, TRIP_REQUEST_STATUSES, TRIP_REQUEST_STATUS,
  BOOKING_MODES, BOOKING_MODE, CANCELLATION_POLICIES, CANCELLATION_POLICY, TRIP_STATUSES, TRIP_STATUS,
  USER_ROLES, USER_ROLE,
  VERIFICATION_STATUSES, VERIFICATION_STATUS,
} from '@shared/constants'

/**
 * Ensures object-form constants stay in sync with their source arrays.
 * If someone adds a value to the array, these tests will fail until
 * the derived object is re-generated (which happens automatically
 * since objects are derived via Object.fromEntries).
 */
describe('Shared constants — array ↔ object sync', () => {
  it('BOOKING_STATUS keys/values match BOOKING_STATUSES', () => {
    expect(Object.keys(BOOKING_STATUS).sort()).toEqual([...BOOKING_STATUSES].sort())
    expect(Object.values(BOOKING_STATUS).sort()).toEqual([...BOOKING_STATUSES].sort())
  })

  it('TRIP_REQUEST_STATUS keys/values match TRIP_REQUEST_STATUSES', () => {
    expect(Object.keys(TRIP_REQUEST_STATUS).sort()).toEqual([...TRIP_REQUEST_STATUSES].sort())
    expect(Object.values(TRIP_REQUEST_STATUS).sort()).toEqual([...TRIP_REQUEST_STATUSES].sort())
  })

  it('BOOKING_MODE keys/values match BOOKING_MODES', () => {
    expect(Object.keys(BOOKING_MODE).sort()).toEqual([...BOOKING_MODES].sort())
    expect(Object.values(BOOKING_MODE).sort()).toEqual([...BOOKING_MODES].sort())
  })

  it('CANCELLATION_POLICY keys/values match CANCELLATION_POLICIES', () => {
    expect(Object.keys(CANCELLATION_POLICY).sort()).toEqual([...CANCELLATION_POLICIES].sort())
    expect(Object.values(CANCELLATION_POLICY).sort()).toEqual([...CANCELLATION_POLICIES].sort())
  })

  it('TRIP_STATUS keys/values match TRIP_STATUSES', () => {
    expect(Object.keys(TRIP_STATUS).sort()).toEqual([...TRIP_STATUSES].sort())
    expect(Object.values(TRIP_STATUS).sort()).toEqual([...TRIP_STATUSES].sort())
  })

  it('USER_ROLE keys/values match USER_ROLES', () => {
    expect(Object.keys(USER_ROLE).sort()).toEqual([...USER_ROLES].sort())
    expect(Object.values(USER_ROLE).sort()).toEqual([...USER_ROLES].sort())
  })

  it('VERIFICATION_STATUS keys/values match VERIFICATION_STATUSES', () => {
    expect(Object.keys(VERIFICATION_STATUS).sort()).toEqual([...VERIFICATION_STATUSES].sort())
    expect(Object.values(VERIFICATION_STATUS).sort()).toEqual([...VERIFICATION_STATUSES].sort())
  })
})
