import { USER_ROLE } from '@shared/constants'
import type { UserRole } from '@shared/constants'

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
export const REFETCH_INTERVAL_BACKGROUND = 5 * 60_000

/** Returns the post-login landing route based on user role. */
export function getHomeRoute(role?: string): string {
  if (role === USER_ROLE.ADMIN) return '/admin'
  if (role === USER_ROLE.ORGANIZER) return '/dashboard'
  return '/trips'
}

// ─── Auth routing ─────────────────────────────────
export const VERIFY_PHONE_ROUTE = '/verify-phone'
export const ONBOARDING_ROUTE = '/onboarding'

/**
 * Single choke point for "where does this user go next" after any
 * signup/login success handler. Mandatory phone verification wins over
 * everything else — no role exemption, no new-user exemption — so an
 * unverified user is always sent to VERIFY_PHONE_ROUTE regardless of
 * isNewUser/returnTo. See docs/rnd plan: Mandatory Phone Verification.
 */
export function getPostAuthRoute(params: {
  isNewUser: boolean
  user?: { role?: UserRole | string; phoneVerified?: boolean } | null
  returnTo?: string | null
}): string {
  if (!params.user?.phoneVerified) return VERIFY_PHONE_ROUTE
  if (params.isNewUser) return ONBOARDING_ROUTE
  return params.returnTo ?? getHomeRoute(params.user?.role)
}
