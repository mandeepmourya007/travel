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
        state?.setHasHydrated(true)
        // accessToken is never persisted (XSS risk — storing JWTs in localStorage exposes them
        // to any injected script). On rehydration, if the user was previously authenticated,
        // proactively fetch a fresh token using the HttpOnly refresh-token cookie. This ensures
        // socket-connector and other accessToken consumers have a token immediately rather than
        // waiting for the first 401 → lazy-refresh → retry cycle.
        // Using native fetch (not apiClient) to avoid a circular import — api-client.ts already
        // imports from this store. The api-client 401 interceptor remains the fallback for
        // concurrent-tab and network-failure edge cases.
        if (state?.isAuthenticated && !state.accessToken) {
          const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1'
          fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
            .then((body: { data?: { accessToken?: unknown } }) => {
              const token = body.data?.accessToken
              if (typeof token === 'string') {
                useAuthStore.setState({ accessToken: token })
              } else {
                state.clearAuth()
              }
            })
            .catch(() => {
              // Refresh-token cookie expired or network failure — clear stale auth state
              // so the user is not stuck in a "looks logged in, but every request fails" loop.
              state.clearAuth()
            })
        }
      },
    },
  ),
)
