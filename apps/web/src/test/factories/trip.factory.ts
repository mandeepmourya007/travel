import type { TripDetail, TripSummary } from '@shared/types/trip.types'

let counter = 0

export function makeTripSummary(overrides: Partial<TripSummary> = {}): TripSummary {
  counter++
  return {
    id: `clrk${String(counter).padStart(21, '0')}trip`,
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
      id: `clrk${String(counter).padStart(21, '0')}org`,
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
      { day: 1, title: 'Day 1', description: 'Arrival', activities: [{ title: 'Check-in', time: '2:00 PM' }, { title: 'Welcome dinner', time: '7:00 PM' }] },
      { day: 2, title: 'Day 2', description: 'Explore', activities: [{ title: 'Beach visit', time: '9:00 AM' }, { title: 'Water sports', time: '2:00 PM' }] },
    ],
    status: 'ACTIVE',
    acceptingBookings: true,
    bookingDeadline: null,
    earlyBirdDeadline: null,
    organizer: {
      ...summary.organizer,
      id: `org-${counter}`,
      totalTrips: 10,
      memberSince: '2023-01-01',
    },
    pickupPoints: [
      { id: 'clrk00000000000000pickup1', type: 'PICKUP' as const, label: 'Delhi Airport T3', time: '06:00 AM', extraCharge: 500, sortOrder: 0, address: null },
      { id: 'clrk00000000000000pickup2', type: 'PICKUP' as const, label: 'Kashmere Gate ISBT', time: '07:00 AM', extraCharge: 0, sortOrder: 1, address: null },
    ],
    dropPoints: [
      { id: 'clrk000000000000000drop01', type: 'DROP' as const, label: 'Delhi Airport T3', time: '08:00 PM', extraCharge: 500, sortOrder: 0, address: null },
    ],
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
