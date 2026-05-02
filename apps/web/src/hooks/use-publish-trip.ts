import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys, organizerKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { TripSummary } from '@shared/types/trip.types'

/**
 * Publishes a draft trip (DRAFT → ACTIVE) and invalidates related caches.
 *
 * Invalidates: tripKeys.myTrips(), organizerKeys.stats()
 * Error handling: shows error toast via onError callback
 */
export function usePublishTrip() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.post<{ success: true; data: TripSummary }>(
        `/trips/${tripId}/publish`,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.myTrips() })
      queryClient.invalidateQueries({ queryKey: organizerKeys.stats() })
      toast({ variant: 'success', title: 'Trip published!' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to publish trip' })
    },
  })
}
