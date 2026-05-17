export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Safarnama'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// ─── Data Fetching ───────────────────────────────
export const API_TIMEOUT_MS = 15_000
export const STALE_TIME_DEFAULT = 15_000
export const STALE_TIME_REALTIME = 30_000
export const STALE_TIME_STATIC = 5 * 60_000
export const REFETCH_INTERVAL_REALTIME = 30_000

/** Returns the post-login landing route based on user role. */
export function getHomeRoute(role?: string): string {
  return role === 'ORGANIZER' ? '/dashboard' : '/trips'
}
