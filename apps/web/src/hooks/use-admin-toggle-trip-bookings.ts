import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { adminKeys, tripKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { TripSummary } from '@shared/types/trip.types'

interface AdminToggleBookingsInput {
  tripId: string
  paused: boolean
  reason?: string
  slug: string
}

/**
 * Admin: pauses or resumes bookings on any trip.
 *
 * Invalidates: adminKeys.trips, tripKeys.detail(slug), tripKeys.lists()
 * Error handling: shows error toast via onError callback
 */
export function useAdminToggleTripBookings() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ tripId, paused, reason }: AdminToggleBookingsInput) => {
      const res = await apiClient.patch<{ success: true; data: TripSummary }>(
        `/admin/trips/${tripId}/bookings`,
        { paused, reason },
      )
      return res.data.data
    },
    onSuccess: (_data, { slug, paused }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tripsBase() })
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(slug) })
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
      toast({
        variant: 'success',
        title: paused ? 'Bookings paused' : 'Bookings resumed',
      })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to update booking status' })
    },
  })
}
