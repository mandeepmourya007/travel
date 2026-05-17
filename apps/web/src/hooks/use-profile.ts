import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_STATIC } from '@/lib/constants'
import { useAuthStore } from '@/store/auth.store'
import { profileKeys } from '@/lib/query-keys'
import type { UserProfileResponse, UpdateUserProfileDto, UpdateOrganizerProfileDto, ConnectBankAccountDto, ConnectBankAccountResponse } from '@shared/types/user.types'

/**
 * Fetches the authenticated user's full profile (including organizer data).
 * Query key: profileKeys.me()
 */
export function useProfile() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () =>
      apiClient.get('/auth/profile').then((r) => r.data.data as UserProfileResponse),
    staleTime: STALE_TIME_STATIC,
    enabled: !!accessToken,
  })
}

/**
 * Updates authenticated user's profile (name, role).
 * On success: invalidates profileKeys.me(), updates Zustand auth store.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: UpdateUserProfileDto) =>
      apiClient.patch('/auth/profile', dto).then((r) => r.data.data),
    onSuccess: (data: { id: string; name: string; role: string; accessToken?: string }) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() })
      const { user: currentUser, setAuth, updateUser } = useAuthStore.getState()
      // When the role changes, the backend returns a new access token with the updated role claim
      if (data.accessToken && currentUser) {
        setAuth(
          { ...currentUser, name: data.name, role: data.role as 'TRAVELER' | 'ORGANIZER' | 'ADMIN' },
          data.accessToken,
        )
      } else {
        updateUser({ name: data.name, role: data.role as 'TRAVELER' | 'ORGANIZER' | 'ADMIN' })
      }
    },
  })
}

/**
 * Updates organizer-specific profile fields (businessName, description).
 * On success: invalidates profileKeys.me()
 */
export function useUpdateOrganizerProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: UpdateOrganizerProfileDto) =>
      apiClient.patch('/auth/profile/organizer', dto).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() })
    },
  })
}

/**
 * Connects organizer's bank account via Razorpay Route.
 * On success: invalidates profileKeys.me() so dashboard alerts update.
 */
export function useConnectBankAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dto: ConnectBankAccountDto) =>
      apiClient.post('/auth/profile/organizer/bank', dto).then((r) => r.data.data as ConnectBankAccountResponse),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.me() })
    },
  })
}
