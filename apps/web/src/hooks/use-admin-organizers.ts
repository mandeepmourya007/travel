import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { OrganizerApprovalFilters, OrganizerApprovalItem, ApproveRejectDto } from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

export function useOrganizerApprovals(filters: OrganizerApprovalFilters) {
  return useQuery({
    queryKey: adminKeys.organizers(filters),
    queryFn: async () => {
      const res = await apiClient.get<{
        success: true
        data: OrganizerApprovalItem[]
        pagination: PaginationMeta
      }>('/admin/organizers', { params: filters })
      return { data: res.data.data, pagination: res.data.pagination }
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useOrganizerDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.organizerDetail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: OrganizerApprovalItem }>(
        `/admin/organizers/${id}`,
      )
      return res.data.data
    },
    enabled: !!id,
  })
}

export function useApproveRejectOrganizer() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...dto }: ApproveRejectDto & { id: string }) => {
      const res = await apiClient.patch<{ success: true; data: { profileId: string; status: string } }>(
        `/admin/organizers/${id}/status`,
        dto,
      )
      return res.data.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.organizersBase() })
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() })
      toast({
        variant: 'success',
        title: `Organizer ${variables.action === 'APPROVED' ? 'approved' : 'rejected'} successfully`,
      })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to update organizer status. Please try again.' })
    },
  })
}
