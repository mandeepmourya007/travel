import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  name: string
  email?: string
  role: 'TRAVELER' | 'ORGANIZER' | 'ADMIN'
  avatarUrl?: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  completedOnboarding: boolean
  _hasHydrated: boolean
  setAuth: (user: AuthUser, accessToken: string) => void
  updateUser: (partial: Partial<AuthUser>) => void
  markOnboardingComplete: () => void
  clearAuth: () => void
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      completedOnboarding: false,
      _hasHydrated: false,
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
      markOnboardingComplete: () => set({ completedOnboarding: true }),
      clearAuth: () =>
        set({ user: null, accessToken: null, isAuthenticated: false, completedOnboarding: false }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'travel-auth',
      partialize: (state) => ({
        user: state.user,
        // accessToken is intentionally NOT persisted — storing raw JWTs in localStorage
        // exposes them to XSS. The HttpOnly refresh-token cookie is the durable credential.
        // A fresh access token is obtained proactively in onRehydrateStorage below,
        // with the api-client 401 interceptor as the fallback.
        isAuthenticated: state.isAuthenticated,
        completedOnboarding: state.completedOnboarding,
      }),
      onRehydrateStorage: () => (state) => {
        // If the user was not previously authenticated (or storage is corrupt), unblock
        // the UI immediately — nothing to restore.
        if (!state?.isAuthenticated) {
          useAuthStore.setState({ _hasHydrated: true })
          return
        }

        // The user was authenticated. accessToken is intentionally NOT persisted (storing a
        // raw JWT in localStorage exposes it to any XSS payload). The HttpOnly refresh-token
        // cookie is the durable credential — use it to silently obtain a fresh access token.
        //
        // Critical: _hasHydrated is set only AFTER this fetch settles, never before.
        //
        // Why this matters:
        //   Setting _hasHydrated=true immediately (the old behaviour) unblocks AuthGuard and
        //   lets child components render with accessToken=null. Several data-fetching hooks
        //   (useOrganizerStats, useNotifications, useUnreadCount, useWalletBalance, etc.) have
        //   no `enabled: !!accessToken` guard and fire API calls the moment they mount. The
        //   server returns 401 for every unauthenticated request, which triggers a second
        //   doRefresh() inside the apiClient interceptor. Now two concurrent /auth/refresh
        //   requests race each other with the same refresh-token cookie. Even though the
        //   30-second grace period usually lets both succeed, any transient failure in either
        //   path calls clearAuth() and logs the user out — reproducibly, on every page refresh.
        //
        //   By holding _hasHydrated=false until this fetch resolves, components stay behind
        //   the AuthGuard spinner, no API calls fire without a token, and the 401/doRefresh
        //   path is never triggered during hydration.
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1'
        const controller = new AbortController()
        // Covers Render free-tier cold starts (typically 30-50s after inactivity).
        const HYDRATION_REFRESH_TIMEOUT_MS = 50_000
        const timeoutId = setTimeout(() => controller.abort(), HYDRATION_REFRESH_TIMEOUT_MS)
        fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include', signal: controller.signal })
          .then((r): Promise<{ data?: { accessToken?: unknown } } | null> => {
            if (r.ok) return r.json() as Promise<{ data?: { accessToken?: unknown } }>
            // 401 = confirmed auth failure (token expired/revoked/missing).
            // Everything else (5xx, network error, DB unavailable) is transient —
            // same policy as AbortError: keep logged in and let the api-client
            // 401 interceptor handle it on the first real API call.
            if (r.status === 401) {
              return Promise.reject(Object.assign(new Error('401'), { isAuthFailure: true }))
            }
            return Promise.resolve(null)
          })
          .then((body) => {
            clearTimeout(timeoutId)
            if (body === null) {
              // Transient server error — unblock UI without clearing session.
              useAuthStore.setState({ _hasHydrated: true })
              return
            }
            const token = body.data?.accessToken
            if (typeof token === 'string') {
              // Token obtained — unblock the UI with a valid session in a single atomic update.
              useAuthStore.setState({ accessToken: token, _hasHydrated: true })
            } else {
              // Unexpected response shape — treat as auth failure.
              useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, completedOnboarding: false, _hasHydrated: true })
            }
          })
          .catch((err: unknown) => {
            clearTimeout(timeoutId)
            const e = err as { name?: string; isAuthFailure?: boolean }
            if (e.isAuthFailure) {
              // Confirmed 401 — refresh token is invalid or expired.
              useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, completedOnboarding: false, _hasHydrated: true })
              return
            }
            // AbortError (timeout), network error, or any other transient failure.
            // Keep the user "logged in" — the api-client 401 interceptor will call
            // doRefresh() on the first real API call once the server is reachable.
            useAuthStore.setState({ _hasHydrated: true })
          })
      },
    },
  ),
)
