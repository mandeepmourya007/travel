export type TripRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'

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
