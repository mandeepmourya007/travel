import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys, tripKeys } from '@/lib/query-keys'
import { useToast } from '@/components/shared/toast'
import type { VerifyPaymentResponse } from '@shared/types/payment.types'

interface VerifyPaymentInput {
  bookingId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

/**
 * Verifies Razorpay payment signature with backend and confirms booking.
 *
 * POST /bookings/:id/verify-payment → VerifyPaymentResponse
 * Invalidates: bookingKeys.all (so My Bookings reflects new booking)
 * Error handling: shows error toast via onError callback
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ bookingId, ...body }: VerifyPaymentInput) => {
      const res = await apiClient.post<{ success: true; data: VerifyPaymentResponse }>(
        `/bookings/${bookingId}/verify-payment`,
        body,
      )
      return res.data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.all })
    },
    onError: () => {
      toast({ variant: 'error', title: 'Payment verification failed. Please contact support.' })
    },
  })
}
