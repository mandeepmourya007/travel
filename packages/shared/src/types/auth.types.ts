export interface SignupDto {
  email: string
  password: string
  name?: string
  phone?: string
  role?: 'TRAVELER' | 'ORGANIZER'
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
    role: 'TRAVELER' | 'ORGANIZER' | 'ADMIN'
    avatarUrl?: string
  }
  tokens: AuthTokens
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
  role?: 'TRAVELER' | 'ORGANIZER'
}

export interface GoogleAuthDto {
  idToken: string
}

export interface OtpVerifyResponse {
  user: AuthResponse['user']
  tokens: AuthTokens
  isNewUser: boolean
}

export interface JwtPayload {
  userId: string
  role: 'TRAVELER' | 'ORGANIZER' | 'ADMIN'
  iat?: number
  exp?: number
}
