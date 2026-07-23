import { describe, it, expect } from 'vitest'
import { getPostAuthRoute, ONBOARDING_ROUTE } from '@/lib/constants'

describe('getPostAuthRoute', () => {
  it('routes a new user to ONBOARDING_ROUTE regardless of phoneVerified', () => {
    expect(
      getPostAuthRoute({ isNewUser: true, user: { role: 'TRAVELER', phoneVerified: false } }),
    ).toBe(ONBOARDING_ROUTE)
    expect(
      getPostAuthRoute({ isNewUser: true, user: { role: 'ADMIN', phoneVerified: true } }),
    ).toBe(ONBOARDING_ROUTE)
  })

  it('routes an existing user to their role home route regardless of phoneVerified', () => {
    expect(
      getPostAuthRoute({ isNewUser: false, user: { role: 'ORGANIZER', phoneVerified: false } }),
    ).toBe('/dashboard')
    expect(
      getPostAuthRoute({ isNewUser: false, user: { role: 'ADMIN', phoneVerified: false } }),
    ).toBe('/admin')
    expect(
      getPostAuthRoute({ isNewUser: false, user: { role: 'TRAVELER', phoneVerified: true } }),
    ).toBe('/trips')
  })

  it('handles a missing/undefined user gracefully', () => {
    expect(getPostAuthRoute({ isNewUser: false })).toBe('/trips')
    expect(getPostAuthRoute({ isNewUser: false, user: null })).toBe('/trips')
  })

  it('prefers returnTo over the role home route for an existing user', () => {
    expect(
      getPostAuthRoute({
        isNewUser: false,
        user: { role: 'TRAVELER', phoneVerified: true },
        returnTo: '/trips/some-trip',
      }),
    ).toBe('/trips/some-trip')
  })
})
