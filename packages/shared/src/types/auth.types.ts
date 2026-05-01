export interface SignupDto {
  name: string
  email: string
  phone?: string
  password: string
  role: 'TRAVELER' | 'ORGANIZER'
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
    email: string
    role: 'TRAVELER' | 'ORGANIZER' | 'ADMIN'
    avatarUrl?: string
  }
  tokens: AuthTokens
}

export interface JwtPayload {
  userId: string
  role: 'TRAVELER' | 'ORGANIZER' | 'ADMIN'
  iat?: number
  exp?: number
}
