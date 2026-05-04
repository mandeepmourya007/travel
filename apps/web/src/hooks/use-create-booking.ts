import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CreateBookingResponse } from '@shared/types/payment.types'

interface CreateBookingInput {
  tripId: string
  pickupPointId?: string
  dropPointId?: string
  numTravelers: number
  travelers: {
    name: string
    phone: string
    age: number
    gender: 'MALE' | 'FEMALE' | 'OTHER'
    isPrimary: boolean
    emergencyContactName?: string
    emergencyContactPhone?: string
  }[]
}

/**
 * Creates a booking and returns Razorpay order details for checkout.
 *
 * POST /bookings → CreateBookingResponse
 * Error handling: callers use mutateAsync and handle errors (including CONFLICT) in their own catch block.
 */
export function useCreateBooking() {
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const res = await apiClient.post<{ success: true; data: CreateBookingResponse }>(
        '/bookings',
        input,
      )
      return res.data.data
    },
  })
}
