import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys, organizerKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'

/**
 * Soft-deletes a trip and invalidates related caches on success.
 *
 * Invalidates: tripKeys.myTrips(), organizerKeys.stats()
 * Error handling: shows error toast via onError callback
 */
export function useDeleteTrip() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (tripId: string) => {
      await apiClient.delete(`/trips/${tripId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.myTrips() })
      queryClient.invalidateQueries({ queryKey: organizerKeys.stats() })
      toast({ variant: 'success', title: 'Trip deleted' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to delete trip' })
    },
  })
}
