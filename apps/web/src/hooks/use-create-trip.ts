import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys, organizerKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { CreateTripDto, TripSummary } from '@shared/types/trip.types'

/**
 * Creates a new trip and invalidates related caches on success.
 *
 * Invalidates: tripKeys.myTrips(), organizerKeys.stats()
 * Error handling: shows error toast via onError callback
 */
export function useCreateTrip() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ data }: { data: CreateTripDto; silent?: boolean }) => {
      const res = await apiClient.post<{ success: true; data: TripSummary }>('/trips', data)
      return res.data.data
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.myTrips() })
      queryClient.invalidateQueries({ queryKey: organizerKeys.stats() })
      if (!variables.silent) {
        toast({ variant: 'success', title: 'Trip created successfully' })
      }
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to create trip. Please try again.' })
    },
  })
}
