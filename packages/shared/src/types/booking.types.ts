import type { TripRequestStatus } from './trip-request.types'
import type { CancellationPolicy } from './trip.types'
import type { MyBookingTabConst } from '../constants/booking-status'

export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'REFUNDED' | 'EXPIRED'

export interface Booking {
  id: string
  tripId: string
  userId: string
  status: BookingStatus
  totalAmount: number
  numberOfTravelers: number
  createdAt: string
  trip: {
    title: string
    slug: string
    startDate: string
    endDate: string
    destination: { name: string }
  }
}

export interface CreateBookingDto {
  tripId: string
  pickupPointId?: string
  dropPointId?: string
  numTravelers: number
  travelers: TravelerInfo[]
  seatIds?: string[]
}

export interface TravelerInfo {
  name: string
  phone: string
  age: number
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  isPrimary: boolean
  emergencyContactName?: string
  emergencyContactPhone?: string
}

// ─── Organizer Trip Participants View ─────────────────

/** Booking list item shown on the organizer's trip participants dashboard */
export interface TripBookingListItem {
  id: string
  bookingRef: string
  bookingStatus: BookingStatus
  numTravelers: number
  totalAmount: number
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  travelerDetails: TravelerDetailItem[]
}

/** Individual traveler within a booking */
export interface TravelerDetailItem {
  id: string
  name: string
  phone: string | null
  age: number | null
  gender: string | null
  isPrimary: boolean
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  assignedSeat?: {
    seatNumber: number
    seatLabel: string
    vehicleName: string
  } | null
}

/** Filters for GET /trips/:tripId/bookings */
export interface TripBookingFilters {
  bookingStatus?: BookingStatus | BookingStatus[]
  search?: string
  sort?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'
  page?: number
  limit?: number
}

/** Aggregated stats for the trip stats bar */
export interface TripBookingSummary {
  confirmedCount: number
  totalTravelers: number
  seatsLeft: number
  maxGroupSize: number
  revenue: number
  pendingRequestsCount: number
}

// ─── Traveler "My Bookings" View ────────────────────

/** Tab filter values for the My Bookings page — derived from MY_BOOKINGS_TABS */
export type MyBookingTab = MyBookingTabConst

/** Traveler's booking list item — shown on the "My Bookings" page */
export interface MyBookingListItem {
  id: string
  bookingRef: string
  bookingStatus: string
  numTravelers: number
  totalAmount: number
  tripProtection: boolean
  createdAt: string
  cancelledAt: string | null
  trip: {
    id: string
    title: string
    slug: string
    startDate: string
    endDate: string
    photos: string[]
    tripType: string
    cancellationPolicy: CancellationPolicy
    destination: { id: string; name: string; slug: string }
    organizer: { id: string; businessName: string; rating: number; verified: boolean }
  }
  hasReview: boolean
  review: {
    id: string
    overallRating: number
    comment?: string | null
    photos: string[]
    createdAt: string
    editedAt?: string | null
  } | null
  travelerDetails: TravelerDetailItem[]
  pickupPoint?: { id: string; label: string; time?: string | null }
  dropPoint?: { id: string; label: string; time?: string | null }
}

/** Query params for GET /bookings/my */
export interface MyBookingFilters {
  tab?: MyBookingTab
  page?: number
  limit?: number
}

/** Tab count summary returned by GET /bookings/my/summary */
export interface MyBookingSummary {
  all: number
  upcoming: number
  completed: number
  cancelled: number
  paymentPending: number
}

/** Response from GET /bookings/my/trip-status/:tripId */
export interface MyTripBookingStatus {
  /** Active booking status (PENDING_PAYMENT | CONFIRMED) or null */
  bookingStatus: BookingStatus | null
  /** Active request status (PENDING | APPROVED) or null */
  requestStatus: Extract<TripRequestStatus, 'PENDING' | 'APPROVED'> | null
}

/** Request body for POST /bookings/:id/cancel */
export interface CancelBookingDto {
  reason: string
}

/** Response from POST /bookings/:id/cancel */
export interface CancelBookingResult {
  bookingId: string
  bookingStatus: 'CANCELLED'
  refundAmount: number
  refundPercent: number
  cancellationPolicy: string
}
