import type { MyBookingListItem, MyBookingSummary } from '@shared/types/booking.types'
import type { CreateBookingResponse, VerifyPaymentResponse } from '@shared/types/payment.types'

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
    pickupPoint: { id: 'pp-1', label: 'Delhi Airport T3', time: '06:00 AM' },
    dropPoint: { id: 'dp-1', label: 'Delhi Airport T3', time: '08:00 PM' },
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

export function makeCreateBookingResponse(
  overrides: Partial<CreateBookingResponse> = {},
): CreateBookingResponse {
  counter++
  return {
    bookingId: `booking-${counter}`,
    bookingRef: `TRP-2025-${String(counter).padStart(4, '0')}`,
    razorpayOrderId: `order_test_${counter}`,
    razorpayKeyId: 'rzp_test_key123',
    amountInRupees: 5000,
    currency: 'INR',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

export function makeVerifyPaymentResponse(
  overrides: Partial<VerifyPaymentResponse> = {},
): VerifyPaymentResponse {
  return {
    bookingId: `booking-${counter || 1}`,
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'CAPTURED',
    ...overrides,
  }
}

export function resetBookingFactory() {
  counter = 0
}
