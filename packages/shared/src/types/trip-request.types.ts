export type TripRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'

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
