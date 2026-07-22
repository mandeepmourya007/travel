import { describe, it, expect } from 'vitest'
import { getPostAuthRoute, VERIFY_PHONE_ROUTE, ONBOARDING_ROUTE } from '@/lib/constants'

describe('getPostAuthRoute', () => {
  it('routes to VERIFY_PHONE_ROUTE when unverified, regardless of isNewUser', () => {
    expect(getPostAuthRoute({ isNewUser: true, user: { role: 'TRAVELER', phoneVerified: false } })).toBe(
      VERIFY_PHONE_ROUTE,
    )
    expect(getPostAuthRoute({ isNewUser: false, user: { role: 'ADMIN', phoneVerified: false } })).toBe(
      VERIFY_PHONE_ROUTE,
    )
  })

  it('routes to VERIFY_PHONE_ROUTE when user is missing/undefined', () => {
    expect(getPostAuthRoute({ isNewUser: false })).toBe(VERIFY_PHONE_ROUTE)
    expect(getPostAuthRoute({ isNewUser: false, user: null })).toBe(VERIFY_PHONE_ROUTE)
  })

  it('routes a verified new user to ONBOARDING_ROUTE', () => {
    expect(
      getPostAuthRoute({ isNewUser: true, user: { role: 'TRAVELER', phoneVerified: true } }),
    ).toBe(ONBOARDING_ROUTE)
  })

  it('routes a verified existing user to their role home route', () => {
    expect(
      getPostAuthRoute({ isNewUser: false, user: { role: 'ORGANIZER', phoneVerified: true } }),
    ).toBe('/dashboard')
    expect(
      getPostAuthRoute({ isNewUser: false, user: { role: 'ADMIN', phoneVerified: true } }),
    ).toBe('/admin')
    expect(
      getPostAuthRoute({ isNewUser: false, user: { role: 'TRAVELER', phoneVerified: true } }),
    ).toBe('/trips')
  })

  it('prefers returnTo over the role home route for a verified existing user', () => {
    expect(
      getPostAuthRoute({
        isNewUser: false,
        user: { role: 'TRAVELER', phoneVerified: true },
        returnTo: '/trips/some-trip',
      }),
    ).toBe('/trips/some-trip')
  })
})
