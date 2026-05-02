import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripKeys, organizerKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { TripSummary } from '@shared/types/trip.types'

/**
 * Toggles the acceptingBookings flag on an ACTIVE trip.
 *
 * Invalidates: tripKeys.myTrips(), organizerKeys.stats()
 * Error handling: shows error toast via onError callback
 */
export function useToggleBookings() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.patch<{ success: true; data: TripSummary }>(
        `/trips/${tripId}/toggle-bookings`,
      )
      return res.data.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.myTrips() })
      queryClient.invalidateQueries({ queryKey: organizerKeys.stats() })
      toast({ variant: 'success', title: data.currentBookings !== undefined ? 'Booking status updated' : 'Bookings toggled' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to update booking status' })
    },
  })
}
