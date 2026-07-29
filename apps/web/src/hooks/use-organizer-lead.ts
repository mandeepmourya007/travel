import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { organizerLeadKeys } from '@/lib/query-keys'
import { STALE_TIME_REALTIME } from '@/lib/constants'
import { useToast } from '@/components/shared/toast'
import type {
  CreateOrganizerLeadDto,
  OrganizerLeadFilters,
  OrganizerLeadItem,
  UpdateOrganizerLeadStatusDto,
} from '@shared/types/organizer-lead.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

export function useSubmitOrganizerLead() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (payload: CreateOrganizerLeadDto) => {
      const res = await apiClient.post<{ success: true; data: OrganizerLeadItem }>(
        '/organizer-leads',
        payload,
      )
      return res.data.data
    },
    onSuccess: () => {
      toast({
        variant: 'success',
        title: 'Thanks! You\'re on the list',
        description: 'Our team will reach out shortly to get you started.',
      })
    },
    onError: (err: Error) => {
      toast({ variant: 'error', title: err.message || 'Failed to submit. Please try again.' })
    },
  })
}

export function useOrganizerLeads(filters: OrganizerLeadFilters) {
  return useQuery({
    queryKey: organizerLeadKeys.list(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: OrganizerLeadItem[]
        pagination: PaginationMeta
      }>('/admin/organizer-leads', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: STALE_TIME_REALTIME,
    placeholderData: (prev) => prev,
  })
}

export function useUpdateOrganizerLeadStatus() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & UpdateOrganizerLeadStatusDto) => {
      const res = await apiClient.patch<{ success: true; data: OrganizerLeadItem }>(
        `/admin/organizer-leads/${id}`,
        body,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizerLeadKeys.all })
      toast({ variant: 'success', title: 'Status updated' })
    },
    onError: (err: Error) => {
      toast({ variant: 'error', title: err.message || 'Failed to update status' })
    },
  })
}
