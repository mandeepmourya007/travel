import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys, docReviewKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type {
  OrganizerDocReviewDetail,
  ReviewDocDto,
  AddDocCommentDto,
  DocumentReviewCommentItem,
} from '@shared/types/admin.types'

// ─── Admin hooks ─────────────────────────────────────

export function useDocReviewDetail(organizerId: string) {
  return useQuery({
    queryKey: adminKeys.docReviewDetail(organizerId),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: OrganizerDocReviewDetail }>(
        `/admin/organizers/${organizerId}/documents`,
      )
      return res.data.data
    },
    enabled: !!organizerId,
  })
}

export function useReviewDocument() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({
      organizerId,
      docType,
      ...dto
    }: ReviewDocDto & { organizerId: string; docType: string }) => {
      const res = await apiClient.patch<{
        success: true
        data: { organizerId: string; docType: string; status: string }
      }>(`/admin/organizers/${organizerId}/documents/${docType}/review`, dto)
      return res.data.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.docReviewDetail(variables.organizerId) })
      queryClient.invalidateQueries({ queryKey: adminKeys.organizersBase() })
      queryClient.invalidateQueries({ queryKey: adminKeys.organizerDetail(variables.organizerId) })
      toast({
        variant: 'success',
        title: `Document ${variables.action === 'APPROVED' ? 'approved' : 'rejected'} successfully`,
      })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to review document. Please try again.' })
    },
  })
}

export function useAdminAddDocComment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ organizerId, ...dto }: AddDocCommentDto & { organizerId: string }) => {
      const res = await apiClient.post<{ success: true; data: unknown }>(
        `/admin/organizers/${organizerId}/comments`,
        dto,
      )
      return res.data.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.docReviewDetail(variables.organizerId) })
      toast({ variant: 'success', title: 'Comment added' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to add comment' })
    },
  })
}

// ─── Organizer hooks ─────────────────────────────────

export function useOrganizerDocComments() {
  return useQuery({
    queryKey: docReviewKeys.comments(),
    queryFn: async () => {
      const res = await apiClient.get<{ success: true; data: DocumentReviewCommentItem[] }>(
        '/auth/profile/organizer/doc-comments',
      )
      return res.data.data
    },
    staleTime: 30_000,
  })
}

export function useOrganizerAddDocComment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (dto: AddDocCommentDto) => {
      const res = await apiClient.post<{ success: true; data: unknown }>(
        '/auth/profile/organizer/doc-comments',
        dto,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docReviewKeys.comments() })
      toast({ variant: 'success', title: 'Comment sent' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to send comment' })
    },
  })
}
