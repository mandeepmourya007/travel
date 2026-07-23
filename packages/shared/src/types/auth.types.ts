import type { UserRole, SignupRole } from '../constants/roles'

export interface SignupDto {
  email: string
  password: string
  name?: string
  phone?: string
  role?: SignupRole
  acceptedTerms: true
  acceptedOrganizerAgreement?: boolean
}

export interface LoginDto {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface AuthResponse {
  user: {
    id: string
    name: string
    email?: string
    phone?: string
    phoneVerified: boolean
    role: UserRole
    avatarUrl?: string
  }
  tokens: AuthTokens
}

/** Response for the authenticated "attach phone" flow — no tokens, no session change. */
export interface AttachPhoneResponse {
  phone: string
  phoneVerified: boolean
}

/** Response for the authenticated "attach email" flow — no tokens, no session change. */
export interface AttachEmailResponse {
  email: string
  emailVerified: boolean
}

export interface SendOtpDto {
  phone: string
}

export interface VerifyOtpDto {
  phone: string
  otp: string
}

export interface OtpSendResponse {
  message: string
  retryAfter: number
}

export interface UpdateProfileDto {
  name: string
  role?: SignupRole
  acceptedOrganizerAgreement?: boolean
}

export interface GoogleAuthDto {
  idToken: string
  /** Only required/checked when a brand-new user is created — see AuthService.googleAuth. */
  acceptedTerms?: boolean
}

export interface OtpVerifyResponse {
  user: AuthResponse['user']
  tokens: AuthTokens
  isNewUser: boolean
}

export interface SendEmailOtpDto {
  email: string
}

export interface VerifyEmailOtpDto {
  email: string
  otp: string
}

export interface JwtPayload {
  userId: string
  role: UserRole
  iat?: number
  exp?: number
}
