import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { CancelBookingResult } from '@shared/types/booking.types'

/**
 * Cancels a booking and invalidates related queries.
 *
 * Invalidates: bookingKeys.all (myBookings + mySummary)
 * Error handling: shows error toast via onError callback
 */
export function useCancelBooking() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      const res = await apiClient.post<{ success: true; data: CancelBookingResult }>(
        `/bookings/${bookingId}/cancel`,
        { reason },
      )
      return res.data.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all })
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
