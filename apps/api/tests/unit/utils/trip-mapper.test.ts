import { describe, it, expect } from 'vitest'
import { mapTripToSummary } from '../../../src/utils/trip-mapper'
import { TRENDING_SCORE_THRESHOLD } from '../../../src/utils/constants'
import type { TripForSummary } from '../../../src/utils/trip-mapper'

function makeTrip(overrides: Partial<TripForSummary> = {}): TripForSummary {
  return {
    id: 'trip-1',
    title: 'Test Trip',
    slug: 'test-trip',
    tripType: 'ADVENTURE',
    bookingMode: 'INSTANT',
    pricePerPerson: 5000,
    earlyBirdPrice: null,
    earlyBirdDeadline: null,
    startDate: new Date('2099-01-01'),
    endDate: new Date('2099-01-05'),
    maxGroupSize: 20,
    currentBookings: 5,
    status: 'ACTIVE',
    acceptingBookings: true,
    photos: [],
    trendingScore: null,
    destination: { id: 'd-1', name: 'Goa', slug: 'goa' },
    organizer: {
      id: 'o-1',
      slug: 'organizer-1',
      businessName: 'Test Org',
      rating: 4.5,
      totalReviews: 10,
      verificationStatus: 'APPROVED',
    },
    _count: { reviews: 10 },
    ...overrides,
  }
}

describe('mapTripToSummary — confirmedGroupCount', () => {
  it('defaults to 0 when _count is absent', () => {
    const { confirmedGroupCount } = mapTripToSummary(makeTrip({ _count: undefined }))
    expect(confirmedGroupCount).toBe(0)
  })

  it('defaults to 0 when _count.bookings is absent', () => {
    const { confirmedGroupCount } = mapTripToSummary(makeTrip({ _count: { reviews: 5 } }))
    expect(confirmedGroupCount).toBe(0)
  })

  it('maps _count.bookings to confirmedGroupCount', () => {
    const { confirmedGroupCount } = mapTripToSummary(makeTrip({ _count: { reviews: 5, bookings: 3 } }))
    expect(confirmedGroupCount).toBe(3)
  })
})

describe('mapTripToSummary — pendingRequestCount', () => {
  it('defaults to 0 when _count.tripRequests is absent', () => {
    const { pendingRequestCount } = mapTripToSummary(makeTrip({ _count: { reviews: 0 } }))
    expect(pendingRequestCount).toBe(0)
  })

  it('maps _count.tripRequests to pendingRequestCount', () => {
    const { pendingRequestCount } = mapTripToSummary(makeTrip({ _count: { reviews: 0, tripRequests: 4 } }))
    expect(pendingRequestCount).toBe(4)
  })
})

describe('mapTripToSummary — isTrending', () => {
  it('is false when trendingScore is null', () => {
    const { isTrending } = mapTripToSummary(makeTrip({ trendingScore: null }))
    expect(isTrending).toBe(false)
  })

  it('is false when trendingScore is 0', () => {
    const { isTrending } = mapTripToSummary(makeTrip({ trendingScore: 0 }))
    expect(isTrending).toBe(false)
  })

  it('is false when trendingScore is below the threshold', () => {
    const { isTrending } = mapTripToSummary(makeTrip({ trendingScore: TRENDING_SCORE_THRESHOLD - 1 }))
    expect(isTrending).toBe(false)
  })

  it('is true when trendingScore equals the threshold exactly', () => {
    const { isTrending } = mapTripToSummary(makeTrip({ trendingScore: TRENDING_SCORE_THRESHOLD }))
    expect(isTrending).toBe(true)
  })

  it('is true when trendingScore exceeds the threshold', () => {
    const { isTrending } = mapTripToSummary(makeTrip({ trendingScore: TRENDING_SCORE_THRESHOLD + 10 }))
    expect(isTrending).toBe(true)
  })
})
