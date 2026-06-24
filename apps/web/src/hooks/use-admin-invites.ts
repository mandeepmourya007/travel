import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { adminKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { OrganizerInviteItem, OrganizerInviteFilters } from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

export function useOrganizerInvites(filters: OrganizerInviteFilters) {
  return useQuery({
    queryKey: adminKeys.invites(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: OrganizerInviteItem[]
        pagination: PaginationMeta
      }>('/admin/organizer-invites', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })
}

export function useSendOrganizerInvite() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (email: string) => {
      const res = await apiClient.post<{ success: true; data: { token: string; email: string } }>(
        '/auth/organizer-invite',
        { email },
      )
      return res.data.data
    },
    onSuccess: (_data, email) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.invitesBase() })
      toast({ variant: 'success', title: `Invite sent to ${email}` })
    },
    onError: (err: Error) => {
      toast({ variant: 'error', title: err.message || 'Failed to send invite' })
    },
  })
}
