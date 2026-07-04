import type { PaymentProviderConst, PaymentTypeConst, PaymentStatusConst } from '../constants/payment'
import type { SortOrder, SORT_FIELD } from '../constants/sort'

export interface CreateBookingResponse {
  bookingId: string
  bookingRef: string
  amountInRupees: number
  currency: string
  expiresAt: string
  /** Which payment gateway created this order — determines checkout flow on FE */
  provider: PaymentProviderConst
  /** Provider-neutral order identifier */
  gatewayOrderId: string
  // ── Razorpay-specific (present when provider='razorpay') ─────────
  razorpayOrderId?: string
  razorpayKeyId?: string
  // ── Cashfree-specific (present when provider='cashfree') ─────────
  paymentSessionId?: string
}

// ─── Payment History Types ───────────────────────────

/** Single payment transaction row — used in all 3 views (traveler/organizer/admin) */
export interface PaymentHistoryItem {
  id: string
  // ESCROW_RELEASE = SafePay payout — funds released to organizer after trip completion. Kept as DB enum value.
  type: PaymentTypeConst
  status: PaymentStatusConst
  amount: number
  currency: string
  razorpayPaymentId: string | null
  razorpayRefundId: string | null
  failureReason: string | null
  createdAt: string
  /** True when this is a REFUND transaction for less than the booking total (partial refund) */
  isPartialRefund: boolean
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
  // ESCROW_RELEASE = SafePay payout. See PaymentHistoryItem for details.
  type?: PaymentTypeConst
  status?: PaymentStatusConst
  fromDate?: string
  toDate?: string
  tripId?: string
  page?: number
  limit?: number
}

/** Admin-specific filters — extends base with search fields */
export interface AdminPaymentFilters extends PaymentHistoryFilters {
  userId?: string
  tripId?: string
  bookingRef?: string
}

/** Organizer global payment filters — extends base with trip scope and sorting */
export interface OrganizerPaymentFilters extends PaymentHistoryFilters {
  /** Scope to a single trip owned by the organizer */
  tripId?: string
  sortBy?: (typeof SORT_FIELD)[keyof typeof SORT_FIELD]
  sortOrder?: SortOrder
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
  /** Provider-neutral order ID — required when razorpayOrderId is absent */
  orderId?: string
  /** Payment ID — required for Razorpay; optional/undefined for Cashfree */
  paymentId?: string
  /** HMAC signature — required for Razorpay; not used for Cashfree */
  signature?: string
  provider?: PaymentProviderConst
  // ── Legacy fields — kept for backward compat during transition ──────────
  razorpayOrderId?: string
  razorpayPaymentId?: string
  razorpaySignature?: string
}

export interface VerifyPaymentResponse {
  bookingId: string
  bookingStatus: string
  paymentStatus: string
  bookingRef: string
}
