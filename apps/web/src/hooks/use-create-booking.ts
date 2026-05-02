import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/shared/toast'
import type { CreateBookingResponse } from '@shared/types/payment.types'

interface CreateBookingInput {
  tripId: string
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
 * Error handling: shows error toast via onError callback
 */
export function useCreateBooking() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const res = await apiClient.post<{ success: true; data: CreateBookingResponse }>(
        '/bookings',
        input,
      )
      return res.data.data
    },
    onError: () => {
      toast({ variant: 'error', title: 'Failed to create booking. Please try again.' })
    },
  })
}
