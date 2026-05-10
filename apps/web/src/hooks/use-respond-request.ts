import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { tripRequestKeys, bookingKeys, organizerKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
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
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ tripId, requestId, status, rejectionReason }: RespondPayload) => {
      const res = await apiClient.patch<{
        success: true
        data: TripRequestListItem
      }>(`/trips/${tripId}/requests/${requestId}`, { status, rejectionReason })
      return res.data.data
    },
    onSuccess: (_data, { status, tripId }) => {
      queryClient.invalidateQueries({ queryKey: tripRequestKeys.all })
      queryClient.invalidateQueries({ queryKey: bookingKeys.tripSummary(tripId) })
      queryClient.invalidateQueries({ queryKey: organizerKeys.stats() })
      toast({
        variant: 'success',
        title: status === 'APPROVED' ? 'Request approved' : 'Request rejected',
      })
    },
    onError: (err) => {
      toast({ variant: 'error', title: (err as Error).message || 'Failed to respond to request. Please try again.' })
    },
  })
}
