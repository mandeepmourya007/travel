export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Safarnama'
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// ─── Legal / Company ─────────────────────────────
// Centralised here so any contact change updates all policy pages, FAQ, and
// consent text in one place. DPDPA 2023 and IT Rules 2021 require the
// grievance officer contact — including a real person's name — to be accurate
// wherever it appears. Update GRIEVANCE_OFFICER_NAME before going live.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@safarnama.in'
export const GRIEVANCE_EMAIL = process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || 'grievance@safarnama.in'
export const COMPANY_ADDRESS = 'Pune, Maharashtra, India'
// IT (Intermediary Guidelines) Rules 2021 Rule 3(2)(b) requires the Grievance
// Officer to be identified by actual name — not just a role/email. Set this
// via env var in production so it can be updated without a redeploy.
export const GRIEVANCE_OFFICER_NAME =
  process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME || 'Mandeep Mourya'

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
