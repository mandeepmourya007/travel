import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys } from '@/lib/query-keys'
import type { VerifyPaymentResponse } from '@shared/types/payment.types'

/**
 * Manually polls Razorpay for the order status and confirms the booking if paid.
 * Used when payment was deducted but the booking is still "Pending Payment".
 *
 * POST /bookings/:id/sync-payment → VerifyPaymentResponse
 */
export function useSyncPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiClient.post<{ success: true; data: VerifyPaymentResponse }>(
        `/bookings/${bookingId}/sync-payment`,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all })
    },
  })
}
