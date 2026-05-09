export const USER_ROLES = ['TRAVELER', 'ORGANIZER', 'ADMIN'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const SIGNUP_ROLES = ['TRAVELER', 'ORGANIZER'] as const
export type SignupRole = (typeof SIGNUP_ROLES)[number]

export const DEFAULT_USER_NAME = 'User'
