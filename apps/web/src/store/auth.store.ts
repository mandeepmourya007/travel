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
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        completedOnboarding: state.completedOnboarding,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
