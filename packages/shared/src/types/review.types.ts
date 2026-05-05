export interface Review {
  id: string
  tripId: string
  bookingId: string
  userId: string
  overallRating: number
  organizationRating?: number | null
  valueRating?: number | null
  safetyRating?: number | null
  accuracyRating?: number | null
  comment?: string | null
  photos: string[]
  editedAt?: string | null
  organizerReply?: string | null
  organizerReplyAt?: string | null
  createdAt: string
  user: {
    id: string
    name: string
    avatarUrl?: string | null
  }
}

export interface CreateReviewDto {
  tripId: string
  bookingId: string
  overallRating: number
  organizationRating?: number
  valueRating?: number
  safetyRating?: number
  accuracyRating?: number
  comment?: string
  photos?: string[]
}

export interface UpdateReviewDto {
  overallRating?: number
  organizationRating?: number
  valueRating?: number
  safetyRating?: number
  accuracyRating?: number
  comment?: string
  photos?: string[]
}

export interface OrganizerReplyDto {
  reply: string
}

export interface ReviewListFilters {
  page?: number
  limit?: number
  sort?: 'newest' | 'oldest' | 'rating_high' | 'rating_low'
}

/** Rating distribution for trip review summary */
export interface ReviewSummary {
  averageRating: number
  totalReviews: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}
