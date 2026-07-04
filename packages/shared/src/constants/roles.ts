export const USER_ROLES = ['TRAVELER', 'ORGANIZER', 'ADMIN'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Object form for dot-access: USER_ROLE.TRAVELER — derived from array */
export const USER_ROLE = Object.fromEntries(
  USER_ROLES.map((s) => [s, s]),
) as { readonly [K in UserRole]: K }

export const SIGNUP_ROLES = ['TRAVELER', 'ORGANIZER'] as const
export type SignupRole = (typeof SIGNUP_ROLES)[number]

/** Roles allowed on traveler-facing pages — includes ADMIN for impersonation. */
export const TRAVELER_ROLES = [USER_ROLE.TRAVELER, USER_ROLE.ADMIN] as const

export const DEFAULT_USER_NAME = 'User'
export const DEFAULT_CUSTOMER_NAME = 'Traveler'
