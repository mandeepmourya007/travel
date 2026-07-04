import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys, tripKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { TripSummary } from '@shared/types/trip.types'

interface AdminSetVisibilityInput {
  tripId: string
  hidden: boolean
  reason?: string
  slug: string
}

export function useAdminSetTripVisibility() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ tripId, hidden, reason }: AdminSetVisibilityInput) => {
      const res = await apiClient.patch<{ success: true; data: TripSummary }>(
        `/admin/trips/${tripId}/visibility`,
        { hidden, reason },
      )
      return res.data.data
    },
    onSuccess: (_data, { slug, hidden }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tripsBase() })
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(slug) })
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
      toast({
        variant: 'success',
        title: hidden ? 'Trip hidden' : 'Trip made visible',
      })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to update trip visibility' })
    },
  })
}
