import type { TripDetail, TripSummary } from '@shared/types/trip.types'

let counter = 0

export function makeTripSummary(overrides: Partial<TripSummary> = {}): TripSummary {
  counter++
  return {
    id: `trip-${counter}`,
    title: `Test Trip ${counter}`,
    slug: `test-trip-${counter}`,
    destination: { id: `dest-${counter}`, name: 'Goa', slug: 'goa' },
    tripType: 'BEACH',
    bookingMode: 'INSTANT',
    pricePerPerson: 5000 + counter * 1000,
    earlyBirdPrice: null,
    startDate: '2025-03-01',
    endDate: '2025-03-04',
    maxGroupSize: 20,
    currentBookings: 8,
    organizer: {
      businessName: `Organizer ${counter}`,
      rating: 4.2,
      totalReviews: 15,
      verified: true,
    },
    photos: [`/photo-${counter}.jpg`],
    ...overrides,
  }
}

export function makeTripDetail(overrides: Partial<TripDetail> = {}): TripDetail {
  const summary = makeTripSummary(overrides)
  return {
    ...summary,
    description: `A great trip to ${summary.destination.name}`,
    minGroupSize: 5,
    cancellationPolicy: 'FLEXIBLE',
    inclusions: ['Transport', 'Meals', 'Accommodation'],
    exclusions: ['Personal expenses'],
    itinerary: [
      { day: 1, title: 'Day 1', description: 'Arrival', activities: ['Check-in', 'Welcome dinner'] },
      { day: 2, title: 'Day 2', description: 'Explore', activities: ['Beach visit', 'Water sports'] },
    ],
    status: 'ACTIVE',
    organizer: {
      ...summary.organizer,
      id: `org-${counter}`,
      totalTrips: 10,
      memberSince: '2023-01-01',
    },
    reviews: [],
    ...overrides,
  }
}

/**
 * Reset counter between tests if needed.
 */
export function resetTripFactory() {
  counter = 0
}
