export interface CreateBookingDto {
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

export interface CreateBookingResponse {
  bookingId: string
  bookingRef: string
  razorpayOrderId: string
  razorpayKeyId: string
  amountInRupees: number
  currency: string
  expiresAt: string
}

export interface VerifyPaymentDto {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

export interface VerifyPaymentResponse {
  bookingId: string
  bookingStatus: string
  paymentStatus: string
}
