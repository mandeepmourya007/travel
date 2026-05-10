export const USER_ROLES = ['TRAVELER', 'ORGANIZER', 'ADMIN'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Object form for dot-access: USER_ROLE.TRAVELER — derived from array */
export const USER_ROLE = Object.fromEntries(
  USER_ROLES.map((s) => [s, s]),
) as { readonly [K in UserRole]: K }

export const SIGNUP_ROLES = ['TRAVELER', 'ORGANIZER'] as const
export type SignupRole = (typeof SIGNUP_ROLES)[number]

export const DEFAULT_USER_NAME = 'User'
