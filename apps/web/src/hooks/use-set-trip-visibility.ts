import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys, organizerKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { TripSummary } from '@shared/types/trip.types'

interface SetVisibilityInput {
  tripId: string
  hidden: boolean
  reason?: string
  slug: string
}

/**
 * Hides or unhides a trip (organizer, own trips only).
 *
 * Invalidates: myTrips, organizerKeys.stats(), public trip detail, all trip lists
 * Error handling: shows error toast via onError callback
 */
export function useSetTripVisibility() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ tripId, hidden, reason }: SetVisibilityInput) => {
      const res = await apiClient.patch<{ success: true; data: TripSummary }>(
        `/trips/${tripId}/visibility`,
        { hidden, reason },
      )
      return res.data.data
    },
    onSuccess: (_data, { slug, hidden }) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.myTrips() })
      queryClient.invalidateQueries({ queryKey: organizerKeys.stats() })
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(slug) })
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
      toast({
        variant: 'success',
        title: hidden ? 'Trip hidden from public listing' : 'Trip is now visible to the public',
      })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to update trip visibility' })
    },
  })
}
