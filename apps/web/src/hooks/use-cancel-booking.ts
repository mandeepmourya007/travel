import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys, tripKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { CancelBookingResult } from '@shared/types/booking.types'

/**
 * Cancels a booking and invalidates related queries.
 *
 * Invalidates: bookingKeys.all, tripKeys.lists(), and the specific trip detail
 * (so the available seats count updates immediately on the trip page).
 */
export function useCancelBooking() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string; tripSlug?: string }) => {
      const res = await apiClient.post<{ success: true; data: CancelBookingResult }>(
        `/bookings/${bookingId}/cancel`,
        { reason },
      )
      return res.data.data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
      if (variables.tripSlug) {
        queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripSlug) })
      } else {
        queryClient.invalidateQueries({ queryKey: tripKeys.details() })
      }
      toast({
        variant: 'success',
        title: `Booking cancelled — ₹${data.refundAmount.toLocaleString('en-IN')} refund (${data.refundPercent}%)`,
      })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to cancel booking. Please try again.' })
    },
  })
}
