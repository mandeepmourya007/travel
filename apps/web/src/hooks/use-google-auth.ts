import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import type { AuthResponse } from '@shared/types/auth.types'
import type { UserRole } from '@shared/constants'

type GoogleAuthResponse = AuthResponse & { isNewUser: boolean }

interface UseGoogleAuthOptions {
  onSuccess?: (data: GoogleAuthResponse) => void
  onError?: () => void
}

/**
 * Sends Google idToken to backend for authentication.
 * On success: sets auth state in Zustand store, then runs the caller's onSuccess.
 *
 * IMPORTANT: callbacks are registered at the MUTATION level (here), NOT via the
 * per-call mutate(idToken, { onSuccess }) form. The login page swaps to a loading
 * spinner the instant the user taps the Google button, which unmounts the
 * GoogleAuthSection that calls mutate(). React Query drops per-call callbacks on
 * unmount but still runs mutation-level ones — so the post-login redirect (which
 * lives in the caller's onSuccess) only fires reliably from here. Without this the
 * user authenticates (navbar shows their name) but is never redirected, and is
 * stranded on the login page.
 */
export function useGoogleAuth(opts?: UseGoogleAuthOptions) {
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
          role: data.user.role as UserRole,
          avatarUrl: data.user.avatarUrl,
        },
        data.tokens.accessToken,
      )
      opts?.onSuccess?.(data)
    },
    onError: () => {
      opts?.onError?.()
    },
  })
}
