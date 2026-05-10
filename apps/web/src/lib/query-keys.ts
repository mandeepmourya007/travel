import type { TripFilters } from '@shared/types/trip.types'
import type { TripBookingFilters, MyBookingFilters } from '@shared/types/booking.types'
import type { TripRequestFilters } from '@shared/types/trip-request.types'
import type { PaymentHistoryFilters, AdminPaymentFilters } from '@shared/types/payment.types'
import type { WalletTransactionFilters } from '@shared/types/wallet.types'
import type { ReviewListFilters } from '@shared/types/review.types'
import type { ConversationListFilters } from '@shared/types/chat.types'
import type { OrganizerApprovalFilters, AdminBookingFilters, CashbackTripFilters, CashbackHistoryFilters } from '@shared/types/admin.types'

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
  publicProfile: (id: string, params?: { tripsPage?: number; reviewsPage?: number }) =>
    [...organizerKeys.all, 'public', id, params] as const,
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
  details: () => [...destinationKeys.all, 'detail'] as const,
  detail: (slug: string, params?: { page?: number }) =>
    [...destinationKeys.details(), slug, params] as const,
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
  list: (filters?: Record<string, unknown>) => [...notificationKeys.all, 'list', filters] as const,
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
  cashback: (page?: number) =>
    [...walletKeys.all, 'cashback', page] as const,
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

export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversationList: (filters?: ConversationListFilters) =>
    [...chatKeys.conversations(), filters] as const,
  messages: (conversationId: string) =>
    [...chatKeys.all, 'messages', conversationId] as const,
  messageSearch: (conversationId: string, query: string) =>
    [...chatKeys.all, 'messages', conversationId, 'search', query] as const,
  unreadCount: () => [...chatKeys.all, 'unread-count'] as const,
  flagged: (page?: number, limit?: number) =>
    [...chatKeys.all, 'flagged', page, limit] as const,
}

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  organizersBase: () => [...adminKeys.all, 'organizers'] as const,
  organizers: (filters?: OrganizerApprovalFilters) =>
    filters
      ? [...adminKeys.organizersBase(), filters] as const
      : adminKeys.organizersBase(),
  organizerDetail: (id: string) =>
    [...adminKeys.organizersBase(), 'detail', id] as const,
  bookingsBase: () => [...adminKeys.all, 'bookings'] as const,
  bookings: (filters?: AdminBookingFilters) =>
    filters
      ? [...adminKeys.bookingsBase(), filters] as const
      : adminKeys.bookingsBase(),
  bookingDetail: (id: string) =>
    [...adminKeys.bookingsBase(), 'detail', id] as const,
  cashbackTripsBase: () => [...adminKeys.all, 'cashback', 'trips'] as const,
  cashbackTrips: (filters?: CashbackTripFilters) =>
    [...adminKeys.cashbackTripsBase(), filters] as const,
  cashbackTripDetail: (tripId: string) =>
    [...adminKeys.cashbackTripsBase(), 'detail', tripId] as const,
  cashbackByUserBase: () => [...adminKeys.all, 'cashback', 'by-user'] as const,
  cashbackByUser: (filters?: CashbackHistoryFilters) =>
    [...adminKeys.cashbackByUserBase(), filters] as const,
  cashbackByTripBase: () => [...adminKeys.all, 'cashback', 'by-trip'] as const,
  cashbackByTrip: (filters?: CashbackHistoryFilters) =>
    [...adminKeys.cashbackByTripBase(), filters] as const,
  cashbackUserDetail: (userId: string, filters?: CashbackHistoryFilters) =>
    [...adminKeys.cashbackByUserBase(), 'detail', userId, filters] as const,
}
