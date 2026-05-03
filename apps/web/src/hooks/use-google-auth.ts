import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import type { AuthResponse } from '@shared/types/auth.types'

type GoogleAuthResponse = AuthResponse & { isNewUser: boolean }

/**
 * Sends Google idToken to backend for authentication.
 * On success: sets auth state in Zustand store.
 * Returns isNewUser for routing to onboarding.
 */
export function useGoogleAuth() {
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: (idToken: string) =>
      apiClient.post('/auth/google', { idToken }).then(r => r.data.data as GoogleAuthResponse),
    onSuccess: (data) => {
      setAuth(
        {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role as 'TRAVELER' | 'ORGANIZER' | 'ADMIN',
          avatarUrl: data.user.avatarUrl,
        },
        data.tokens.accessToken,
      )
    },
  })
}
