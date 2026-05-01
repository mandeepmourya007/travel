export interface Review {
  id: string
  tripId: string
  userId: string
  rating: number
  comment: string
  createdAt: string
  user: {
    name: string
    avatarUrl?: string
  }
}

export interface CreateReviewDto {
  tripId: string
  bookingId: string
  rating: number
  comment: string
}
