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
