export type UserRole = 'TRAVELER' | 'ORGANIZER' | 'ADMIN'

export interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  avatarUrl?: string
  isVerified: boolean
  createdAt: string
}

export interface OrganizerProfile {
  id: string
  userId: string
  businessName: string
  description?: string
  rating: number
  totalReviews: number
  totalTrips: number
  verified: boolean
}
