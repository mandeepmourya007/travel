export interface Review {
  id: string
  tripId: string
  userId: string
  overallRating: number
  organizationRating?: number
  valueRating?: number
  safetyRating?: number
  accuracyRating?: number
  comment?: string
  photos: string[]
  createdAt: string
  user: {
    name: string
    avatarUrl?: string
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
