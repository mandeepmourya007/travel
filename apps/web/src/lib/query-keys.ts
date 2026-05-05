import type { TripFilters } from '@shared/types/trip.types'
import type { TripBookingFilters, MyBookingFilters } from '@shared/types/booking.types'
import type { TripRequestFilters } from '@shared/types/trip-request.types'
import type { PaymentHistoryFilters, AdminPaymentFilters } from '@shared/types/payment.types'
import type { WalletTransactionFilters } from '@shared/types/wallet.types'
import type { ReviewListFilters } from '@shared/types/review.types'

export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (filters: TripFilters) => [...tripKeys.lists(), filters] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (slug: string) => [...tripKeys.details(), slug] as const,
  myTrips: (status?: string) => [...tripKeys.all, 'my', status] as const,
  editHistory: (id: string) => [...tripKeys.all, 'history', id] as const,
}

export const uploadKeys = {
  all: ['uploads'] as const,
  signature: () => [...uploadKeys.all, 'signature'] as const,
}

export const organizerKeys = {
  all: ['organizer'] as const,
  stats: () => [...organizerKeys.all, 'stats'] as const,
}

export const bookingKeys = {
  all: ['bookings'] as const,
  myBookings: (filters?: MyBookingFilters) => [...bookingKeys.all, 'my', filters] as const,
  mySummary: () => [...bookingKeys.all, 'my', 'summary'] as const,
  detail: (id: string) => [...bookingKeys.all, 'detail', id] as const,
  myTripStatus: (tripId: string) => [...bookingKeys.all, 'my', 'trip-status', tripId] as const,
  forTrip: (tripId: string, filters?: TripBookingFilters) => [...bookingKeys.all, 'trip', tripId, filters] as const,
  tripSummary: (tripId: string) => [...bookingKeys.all, 'summary', tripId] as const,
}

export const tripRequestKeys = {
  all: ['tripRequests'] as const,
  forTrip: (tripId: string, filters?: TripRequestFilters) => [...tripRequestKeys.all, 'trip', tripId, filters] as const,
  myRequests: () => [...tripRequestKeys.all, 'my'] as const,
  allPending: () => [...tripRequestKeys.all, 'allPending'] as const,
}

export const destinationKeys = {
  all: ['destinations'] as const,
  list: () => [...destinationKeys.all, 'list'] as const,
}

export const reviewKeys = {
  all: ['reviews'] as const,
  forTrip: (tripId: string, filters?: ReviewListFilters) =>
    [...reviewKeys.all, 'trip', tripId, filters] as const,
  myForBooking: (bookingId: string) =>
    [...reviewKeys.all, 'my', 'booking', bookingId] as const,
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread'] as const,
}

export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
}

export const walletKeys = {
  all: ['wallet'] as const,
  balance: () => [...walletKeys.all, 'balance'] as const,
  transactions: (filters?: WalletTransactionFilters) =>
    [...walletKeys.all, 'transactions', filters] as const,
}

export const paymentKeys = {
  all: ['payments'] as const,
  myPayments: (filters?: PaymentHistoryFilters) =>
    [...paymentKeys.all, 'my', filters] as const,
  mySummary: () => [...paymentKeys.all, 'my', 'summary'] as const,
  tripPayments: (tripId: string, filters?: PaymentHistoryFilters) =>
    [...paymentKeys.all, 'trip', tripId, filters] as const,
  tripSummary: (tripId: string) =>
    [...paymentKeys.all, 'trip', tripId, 'summary'] as const,
  adminPayments: (filters?: AdminPaymentFilters) =>
    [...paymentKeys.all, 'admin', filters] as const,
  adminSummary: () => [...paymentKeys.all, 'admin', 'summary'] as const,
}
