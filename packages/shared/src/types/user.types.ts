import type { UserRole, SignupRole } from '../constants/roles'
import type { VerificationStatus } from '../constants/verification-status'
import type { CashfreeAccountTypeConst } from '../constants/payment'
import type { DocumentReviewItem } from './admin.types'

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
  emailVerified: boolean
  createdAt: string
  /**
   * Reseller feature — true when an organizer has generated a main link naming this
   * user by email. Populated by `getFullProfile` in `apps/api/src/services/auth.service.ts`
   * from the real `User.isReseller` column. Kept optional for backward compatibility with
   * any older cached/stubbed `UserProfileResponse` object literals.
   */
  isReseller?: boolean
  organizerProfile: OrganizerProfileResponse | null
}

/** Structured verification documents uploaded by the organizer */
export interface OrganizerDocuments {
  aadhaarFront?: string
  aadhaarBack?: string
  panCard?: string
}

/** Organizer-specific fields in profile response */
export interface OrganizerProfileResponse {
  id: string
  slug: string
  businessName: string
  description: string | null
  verificationStatus: VerificationStatus
  rating: number
  totalReviews: number
  totalTripsCompleted: number
  bankAccountLinked: boolean
  documents: OrganizerDocuments | null
  documentReviews?: DocumentReviewItem[]
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
  documents?: OrganizerDocuments
}

/** DTO for POST /auth/profile/organizer/bank — links the organizer's payout bank account */
export interface ConnectBankAccountDto {
  accountHolderName: string
  ifscCode: string
  accountNumber: string
  beneficiaryName: string
  /** Required when PAYMENT_GATEWAY=cashfree; ignored by Razorpay */
  pan?: string
  /** Required when PAYMENT_GATEWAY=cashfree; ignored by Razorpay */
  accountType?: CashfreeAccountTypeConst
}

/** Response from POST /auth/profile/organizer/bank */
export interface ConnectBankAccountResponse {
  bankAccountLinked: boolean
  maskedAccountNumber: string
}
