import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys, tripKeys, vehicleKeys } from '@/lib/query-keys'
import type { VerifyPaymentResponse } from '@shared/types/payment.types'
import type { PaymentProviderConst } from '@shared/constants'

interface VerifyPaymentInput {
  bookingId: string
  /** Provider-neutral order ID */
  orderId: string
  /** Payment ID — required for Razorpay; undefined for Cashfree (server verifies via order status) */
  paymentId?: string
  /** HMAC signature — required for Razorpay; not used for Cashfree */
  signature?: string
  provider?: PaymentProviderConst
  /** Used only for targeted cache invalidation — not sent to the API */
  tripSlug?: string
  /** Used only for targeted cache invalidation — not sent to the API */
  tripId?: string
}

/**
 * Verifies payment signature/status with backend and confirms booking.
 *
 * POST /bookings/:id/verify-payment → VerifyPaymentResponse
 * Razorpay: sends orderId + paymentId + signature (HMAC verified server-side).
 * Cashfree: sends orderId + provider='cashfree' (server does order-status fetch, no HMAC).
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      bookingId,
      tripSlug: _tripSlug,
      tripId: _tripId,
      ...body
    }: VerifyPaymentInput) => {
      const res = await apiClient.post<{ success: true; data: VerifyPaymentResponse }>(
        `/bookings/${bookingId}/verify-payment`,
        body,
      )
      return res.data.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.all })
      queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
      if (variables.tripSlug) {
        queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripSlug) })
      } else {
        queryClient.invalidateQueries({ queryKey: tripKeys.details() })
      }
      if (variables.tripId) {
        queryClient.invalidateQueries({ queryKey: vehicleKeys.seatMap(variables.tripId) })
      }
    },
  })
}
