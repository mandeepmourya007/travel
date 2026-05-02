import type { MyBookingListItem, MyBookingSummary } from '@shared/types/booking.types'

let counter = 0

export function makeMyBooking(overrides: Partial<MyBookingListItem> = {}): MyBookingListItem {
  counter++
  return {
    id: `booking-${counter}`,
    bookingRef: `TRP-2025-${String(counter).padStart(4, '0')}`,
    bookingStatus: 'CONFIRMED',
    numTravelers: 2,
    totalAmount: 9000 + counter * 1000,
    tripProtection: false,
    createdAt: '2025-05-01T10:00:00.000Z',
    cancelledAt: null,
    trip: {
      id: `trip-${counter}`,
      title: `Beach Getaway ${counter}`,
      slug: `beach-getaway-${counter}`,
      startDate: '2025-12-06T00:00:00.000Z',
      endDate: '2025-12-08T00:00:00.000Z',
      photos: [`/photo-${counter}.jpg`],
      tripType: 'BEACH',
      cancellationPolicy: 'FLEXIBLE',
      destination: { id: `dest-${counter}`, name: 'Goa', slug: 'goa' },
      organizer: { id: `org-${counter}`, businessName: `TripVibes ${counter}`, rating: 4.5, verified: true },
    },
    hasReview: false,
    ...overrides,
  }
}

export function makeMyBookingSummary(overrides: Partial<MyBookingSummary> = {}): MyBookingSummary {
  return {
    all: 10,
    upcoming: 4,
    completed: 5,
    cancelled: 1,
    ...overrides,
  }
}

export function resetBookingFactory() {
  counter = 0
}
