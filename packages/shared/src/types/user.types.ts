import type { UserRole, SignupRole } from '../constants/roles'
import type { VerificationStatus } from '../constants/verification-status'

export type { UserRole, SignupRole }

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
  verificationStatus: VerificationStatus
  rating: number
  totalReviews: number
  totalTripsCompleted: number
  bankAccountLinked: boolean
}

/** DTO for PATCH /auth/profile */
export interface UpdateUserProfileDto {
  name?: string
  role?: SignupRole
}

/** DTO for PATCH /auth/profile/organizer */
export interface UpdateOrganizerProfileDto {
  businessName?: string
  description?: string
}
