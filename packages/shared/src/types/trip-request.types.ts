import { z } from 'zod'
import { travelerDetailSchema } from '../validators/booking.schema'

export type TripRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'

/** Traveler detail — derived from shared Zod schema (1NF via TravelerDetail table) */
export type TripRequestTraveler = z.infer<typeof travelerDetailSchema>

export interface TripRequest {
  id: string
  tripId: string
  userId: string
  status: TripRequestStatus
  message?: string
  numberOfTravelers: number
  rejectionReason?: string
  approvalExpiresAt?: string
  createdAt: string
  trip: {
    title: string
    slug: string
    startDate: string
  }
}

export interface CreateTripRequestDto {
  tripId: string
  message?: string
  numberOfTravelers: number
  travelers: TripRequestTraveler[]
}

export interface RespondTripRequestDto {
  status: 'APPROVED' | 'REJECTED'
  rejectionReason?: string
}

// ─── Organizer Trip Participants View ─────────────────

/** Trip request list item shown on the organizer's trip participants dashboard */
export interface TripRequestListItem {
  id: string
  numTravelers: number
  message: string | null
  status: TripRequestStatus
  createdAt: string
  respondedAt: string | null
  responseNote: string | null
  approvalExpiresAt: string | null
  travelerDetails: TripRequestTraveler[] | null
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

/** Filters for GET /trips/:tripId/requests */
export interface TripRequestFilters {
  status?: TripRequestStatus
  search?: string
  page?: number
  limit?: number
}

/** TripRequestListItem extended with trip context — used on the cross-trip pending requests page */
export interface PendingRequestWithTrip extends TripRequestListItem {
  trip: { id: string; title: string; slug: string }
}

// ─── Traveler "Payment Pending" View ─────────────────

/** Traveler's view of their trip request — shown in "Payment Pending" tab on My Bookings */
export interface MyTripRequestItem {
  id: string
  tripId: string
  numTravelers: number
  message: string | null
  status: TripRequestStatus
  approvalExpiresAt: string | null
  createdAt: string
  /** true when status=APPROVED AND approvalExpiresAt > now */
  canPay: boolean
  /** Traveler details collected at request time */
  travelerDetails: TripRequestTraveler[] | null
  trip: {
    id: string
    title: string
    slug: string
    startDate: string
    endDate: string
    photos: string[]
    pricePerPerson: number
    destination: { id: string; name: string; slug: string }
    organizer: { id: string; businessName: string; verified: boolean }
  }
}
