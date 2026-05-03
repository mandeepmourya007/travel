import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripRequestKeys, bookingKeys, organizerKeys } from '@/lib/query-keys'
import type { TripRequestListItem } from '@shared/types/trip-request.types'

interface RespondPayload {
  tripId: string
  requestId: string
  status: 'APPROVED' | 'REJECTED'
  rejectionReason?: string
}

/**
 * Mutation hook to approve or reject a trip request.
 *
 * Invalidates: tripRequestKeys.all, bookingKeys.tripSummary(tripId), organizerKeys.stats()
 * Error handling: returns error for toast display
 */
export function useRespondToRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tripId, requestId, status, rejectionReason }: RespondPayload) => {
      const res = await apiClient.patch<{
        success: true
        data: TripRequestListItem
      }>(`/trips/${tripId}/requests/${requestId}`, { status, rejectionReason })
      return res.data.data
    },
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: tripRequestKeys.all })
      queryClient.invalidateQueries({ queryKey: bookingKeys.tripSummary(tripId) })
      queryClient.invalidateQueries({ queryKey: organizerKeys.stats() })
    },
  })
}
