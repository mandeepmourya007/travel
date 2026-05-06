export interface CreateBookingResponse {
  bookingId: string
  bookingRef: string
  razorpayOrderId: string
  razorpayKeyId: string
  amountInRupees: number
  currency: string
  expiresAt: string
}

// ─── Payment History Types ───────────────────────────

/** Single payment transaction row — used in all 3 views (traveler/organizer/admin) */
export interface PaymentHistoryItem {
  id: string
  type: 'PAYMENT' | 'REFUND' | 'ESCROW_RELEASE'
  status: 'INITIATED' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED'
  amount: number
  currency: string
  razorpayPaymentId: string | null
  razorpayRefundId: string | null
  failureReason: string | null
  createdAt: string
  booking: {
    id: string
    bookingRef: string
    bookingStatus: string
    trip: {
      id: string
      title: string
      slug: string
      destination: { name: string }
    }
    user?: {
      id: string
      name: string
      email: string | null
    }
  }
}

/** Filters for GET /payments/my and GET /payments/trip/:tripId */
export interface PaymentHistoryFilters {
  type?: 'PAYMENT' | 'REFUND' | 'ESCROW_RELEASE'
  status?: 'INITIATED' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED'
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

/** Admin-specific filters — extends base with search fields */
export interface AdminPaymentFilters extends PaymentHistoryFilters {
  userId?: string
  tripId?: string
  bookingRef?: string
}

/** Summary card for Traveler view */
export interface TravelerPaymentSummary {
  totalPaid: number
  totalRefunded: number
  pendingRefunds: number
  transactionCount: number
}

/** Summary card for Organizer per-trip view */
export interface TripPaymentSummary {
  totalRevenue: number
  totalRefunded: number
  netRevenue: number
  platformCommission: number
  organizerEarnings: number
  transactionCount: number
  refundCount: number
}

/** Summary card for Admin global view */
export interface AdminPaymentSummary {
  totalRevenue: number
  totalRefunded: number
  netRevenue: number
  totalCommission: number
  transactionCount: number
  failedCount: number
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