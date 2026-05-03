export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'TripCompare'

/** Returns the post-login landing route based on user role. */
export function getHomeRoute(role?: string): string {
  return role === 'ORGANIZER' ? '/dashboard' : '/trips'
}
