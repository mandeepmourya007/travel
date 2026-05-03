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

/** Full profile response from GET /auth/profile */
export interface UserProfileResponse {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: UserRole
  avatarUrl: string | null
  isVerified: boolean
  phoneVerified: boolean
  createdAt: string
  organizerProfile: OrganizerProfileResponse | null
}

/** Organizer-specific fields in profile response */
export interface OrganizerProfileResponse {
  id: string
  businessName: string
  description: string | null
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  rating: number
  totalReviews: number
  totalTripsCompleted: number
  bankAccountLinked: boolean
}

/** DTO for PATCH /auth/profile */
export interface UpdateUserProfileDto {
  name?: string
  role?: 'TRAVELER' | 'ORGANIZER'
}

/** DTO for PATCH /auth/profile/organizer */
export interface UpdateOrganizerProfileDto {
  businessName?: string
  description?: string
}
