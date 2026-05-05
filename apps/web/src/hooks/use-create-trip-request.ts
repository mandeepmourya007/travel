import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys, tripRequestKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { TripRequestTraveler } from '@shared/types/trip-request.types'

interface CreateTripRequestInput {
  tripId: string
  numberOfTravelers: number
  message?: string
  travelers: TripRequestTraveler[]
}

/**
 * Sends a trip request for a REQUEST_BASED trip.
 *
 * POST /trips/:tripId/request
 * Invalidates: bookingKeys.mySummary() (updates Payment Pending badge)
 */
export function useCreateTripRequest() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ tripId, ...body }: CreateTripRequestInput) => {
      const res = await apiClient.post(`/trips/${tripId}/request`, body)
      return res.data.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.mySummary() })
      queryClient.invalidateQueries({ queryKey: bookingKeys.myTripStatus(variables.tripId) })
      queryClient.invalidateQueries({ queryKey: tripRequestKeys.all })
      toast({ variant: 'success', title: 'Request sent! Check My Bookings for updates.' })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to send request. Please try again.' })
    },
  })
}
