import type {
  PaymentHistoryItem,
  TravelerPaymentSummary,
  TripPaymentSummary,
  AdminPaymentSummary,
} from '@shared/types/payment.types'

let counter = 0

export function resetPaymentFactory() {
  counter = 0
}

export function makePaymentItem(overrides: Partial<PaymentHistoryItem> = {}): PaymentHistoryItem {
  counter++
  return {
    id: `pt_${counter}`,
    type: 'PAYMENT',
    status: 'CAPTURED',
    amount: 4500,
    currency: 'INR',
    razorpayPaymentId: `pay_${counter}`,
    razorpayRefundId: null,
    failureReason: null,
    createdAt: '2025-01-15T10:30:00Z',
    isPartialRefund: false,
    booking: {
      id: `bk_${counter}`,
      bookingRef: `TRP-2025-000${counter}`,
      bookingStatus: 'CONFIRMED',
      trip: {
        id: `trip_${counter}`,
        title: 'Goa Beach Getaway',
        slug: 'goa-beach-getaway',
        destination: { name: 'Goa' },
      },
      user: {
        id: `user_${counter}`,
        name: 'Priya S',
        email: 'priya@test.com',
      },
    },
    ...overrides,
  }
}

export function makeTravelerSummary(overrides: Partial<TravelerPaymentSummary> = {}): TravelerPaymentSummary {
  return {
    totalPaid: 9000,
    totalRefunded: 4500,
    pendingRefunds: 500,
    transactionCount: 5,
    ...overrides,
  }
}

export function makeTripSummary(overrides: Partial<TripPaymentSummary> = {}): TripPaymentSummary {
  return {
    totalRevenue: 45000,
    totalRefunded: 4500,
    netRevenue: 40500,
    platformCommission: 4050,
    organizerEarnings: 36450,
    transactionCount: 12,
    refundCount: 1,
    ...overrides,
  }
}

export function makeAdminSummary(overrides: Partial<AdminPaymentSummary> = {}): AdminPaymentSummary {
  return {
    totalRevenue: 500000,
    totalRefunded: 25000,
    netRevenue: 475000,
    totalCommission: 47500,
    transactionCount: 200,
    failedCount: 3,
    ...overrides,
  }
}
