import type { TripSummary } from './trip.types'
import type { Review, ReviewSummary } from './review.types'
import type { PaginationMeta } from './api-response.types'

export interface OrganizerPublicProfile {
  id: string
  slug: string
  businessName: string
  description: string | null
  verified: boolean
  rating: number
  totalReviews: number
  totalTripsCompleted: number
  memberSince: string
}

export interface OrganizerPublicProfileResponse {
  organizer: OrganizerPublicProfile
  trips: TripSummary[]
  tripsPagination: PaginationMeta
  reviews: Review[]
  reviewsSummary: ReviewSummary
  reviewsPagination: PaginationMeta
}
