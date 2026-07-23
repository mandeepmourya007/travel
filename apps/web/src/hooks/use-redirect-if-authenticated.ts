import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { getPostAuthRoute } from '@/lib/constants'

interface UseRedirectIfAuthenticatedOptions {
  /**
   * Only redirect once onboarding is also complete (default true). Pass `false`
   * for pages that must bounce an authenticated visitor away immediately —
   * regardless of onboarding state — rather than letting them sit on a public
   * login/signup page mid-onboarding (e.g. phone login, organizer-invite signup).
   */
  requireOnboarded?: boolean
  returnTo?: string | null
}

/**
 * Redirects an already-authenticated visitor away from a public login/signup
 * page, through the SAME `getPostAuthRoute` helper the page's own submit
 * handler uses for its post-login push.
 *
 * MUST route through `getPostAuthRoute` — never a raw `getHomeRoute` or a
 * hardcoded path. This effect re-fires on the very next render after a submit
 * handler calls `setAuth()`/`markOnboardingComplete()` (both are synchronous
 * Zustand `set()` calls), making it a second, independent redirect source that
 * races with the handler's own `router.push(...)`. If this effect disagreed
 * with the handler about where an unverified user belongs, it would win the
 * race (it fires later) and silently override the correct destination — this
 * exact bug shipped once across all pages that inlined this effect with a raw
 * `getHomeRoute` call; see `docs/codebase/Auth & Security.md`.
 */
export function useRedirectIfAuthenticated({ requireOnboarded = true, returnTo }: UseRedirectIfAuthenticatedOptions = {}) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const completedOnboarding = useAuthStore((s) => s.completedOnboarding)

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return
    if (requireOnboarded && !completedOnboarding) return
    router.replace(getPostAuthRoute({ isNewUser: false, user: useAuthStore.getState().user, returnTo }))
  }, [hasHydrated, isAuthenticated, completedOnboarding, requireOnboarded, returnTo, router])
}
