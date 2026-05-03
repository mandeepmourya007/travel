import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'

/**
 * Updates authenticated user's profile (name). Used on onboarding page.
 * On success: updates user name in Zustand store.
 */
export function useUpdateProfile() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  return useMutation({
    mutationFn: (dto: { name: string }) =>
      apiClient.patch('/auth/profile', dto).then(r => r.data.data),
    onSuccess: (data) => {
      if (user && accessToken) {
        setAuth({ ...user, name: data.name }, accessToken)
      }
    },
  })
}
