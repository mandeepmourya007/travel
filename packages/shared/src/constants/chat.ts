/** Lowercase chat sender/reader roles — used in conversation unread counting. */
export const CHAT_SENDER_ROLES = ['traveler', 'organizer', 'admin'] as const
export type ChatSenderRole = (typeof CHAT_SENDER_ROLES)[number]

/** Object form for dot-access: CHAT_SENDER_ROLE.TRAVELER — derived from array */
export const CHAT_SENDER_ROLE = Object.fromEntries(
  CHAT_SENDER_ROLES.map((s) => [s.toUpperCase(), s]),
) as { readonly TRAVELER: 'traveler'; readonly ORGANIZER: 'organizer'; readonly ADMIN: 'admin' }
