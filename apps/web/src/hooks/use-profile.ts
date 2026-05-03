import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'

/**
 * Updates authenticated user's profile (name and optionally role).
 * Used on onboarding page after signup/OTP/Google.
 * On success: updates user in Zustand store.
 */
export function useUpdateProfile() {
  const updateUser = useAuthStore((s) => s.updateUser)

  return useMutation({
    mutationFn: (dto: { name: string; role?: 'TRAVELER' | 'ORGANIZER' }) =>
      apiClient.patch('/auth/profile', dto).then(r => r.data.data),
    onSuccess: (data: { id: string; name: string; role: string }) => {
      updateUser({ name: data.name, role: data.role as 'TRAVELER' | 'ORGANIZER' | 'ADMIN' })
    },
  })
}
