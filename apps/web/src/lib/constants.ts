export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'TripCompare'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

/** Returns the post-login landing route based on user role. */
export function getHomeRoute(role?: string): string {
  return role === 'ORGANIZER' ? '/dashboard' : '/trips'
}
