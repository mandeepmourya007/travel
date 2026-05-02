import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys, organizerKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { UpdateTripDto, TripSummary } from '@shared/types/trip.types'

/**
 * Updates an existing trip and invalidates related caches.
 *
 * Invalidates: tripKeys.myTrips(), tripKeys.details(), organizerKeys.stats()
 * Error handling: shows error toast via onError callback
 */
export function useUpdateTrip(tripId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: UpdateTripDto) => {
      const res = await apiClient.put<{ success: true; data: TripSummary }>(
        `/trips/${tripId}`,
        data,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.myTrips() })
      queryClient.invalidateQueries({ queryKey: tripKeys.details() })
      queryClient.invalidateQueries({ queryKey: organizerKeys.stats() })
      toast({ variant: 'success', title: 'Trip updated successfully' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to update trip' })
    },
  })
}
