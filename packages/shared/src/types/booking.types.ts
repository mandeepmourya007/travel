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
  numberOfTravelers: number
  travelers: TravelerInfo[]
}

export interface TravelerInfo {
  name: string
  phone: string
  age: number
  gender: 'MALE' | 'FEMALE' | 'OTHER'
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
}

/** Filters for GET /trips/:tripId/bookings */
export interface TripBookingFilters {
  bookingStatus?: BookingStatus
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
