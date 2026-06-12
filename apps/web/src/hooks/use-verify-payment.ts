import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { bookingKeys, tripKeys, vehicleKeys } from '@/lib/query-keys'
import type { VerifyPaymentResponse } from '@shared/types/payment.types'

interface VerifyPaymentInput {
  bookingId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
  /** Used only for targeted cache invalidation — not sent to the API */
  tripSlug?: string
  /** Used only for targeted cache invalidation — not sent to the API */
  tripId?: string
}

/**
 * Verifies Razorpay payment signature with backend and confirms booking.
 *
 * POST /bookings/:id/verify-payment → VerifyPaymentResponse
 * Invalidates: bookings, the booked trip's detail + trip lists (seat counts
 * changed), and that trip's seat map — not the whole trips domain.
 * Error handling: callers show the error UI (they have the booking ref).
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ bookingId, tripSlug: _tripSlug, tripId: _tripId, ...body }: VerifyPaymentInput) => {
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
