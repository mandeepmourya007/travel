import type { TripFilters } from '@shared/types/trip.types'
import type { TripBookingFilters, MyBookingFilters } from '@shared/types/booking.types'
import type { TripRequestFilters } from '@shared/types/trip-request.types'
import type { PaymentHistoryFilters, AdminPaymentFilters, OrganizerPaymentFilters } from '@shared/types/payment.types'
import type { WalletTransactionFilters } from '@shared/types/wallet.types'
import type { ReviewListFilters, OrganizerReviewFilters } from '@shared/types/review.types'
import type { ConversationListFilters } from '@shared/types/chat.types'
import type { OrganizerApprovalFilters, AdminBookingFilters, CashbackTripFilters, CashbackHistoryFilters, OrganizerInviteFilters, AdminReviewFilters, AdminTravellerFilters, AdminOrganizerDirectoryFilters, AdminTravellerDetailFilters, AdminOrganizerDetailFilters } from '@shared/types/admin.types'

/** Single source of truth for query key string segments. Exported for manual cache invalidation. */
export const QK = {
  LIST: 'list',
  DETAIL: 'detail',
  MY: 'my',
  ALL: 'all',
  ME: 'me',
  SEARCH: 'search',
  SUMMARY: 'summary',
  HISTORY: 'history',
  TRIP: 'trip',
  ORGANIZER: 'organizer',
  MINE: 'mine',
  BOOKING: 'booking',
  TRIP_STATUS: 'trip-status',
  ADMIN: 'admin',
  ORGANIZERS: 'organizers',
  BOOKINGS: 'bookings',
  CASHBACK: 'cashback',
  REVIEWS: 'reviews',
  TRANSACTIONS: 'transactions',
  INVITES: 'invites',
  TRIPS: 'trips',
  REQUESTS: 'requests',
  ACTIVE: 'active',
  POPULAR: 'popular',
  PUBLIC: 'public',
  DOC_REVIEW: 'doc-review',
  BY_USER: 'by-user',
  BY_TRIP: 'by-trip',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  UNREAD: 'unread',
  UNREAD_COUNT: 'unread-count',
  FLAGGED: 'flagged',
  SEAT_MAP: 'seat-map',
  ORGANIZER_SEAT_MAP: 'organizer-seat-map',
  SIGNATURE: 'signature',
  ALL_PENDING: 'allPending',
  MY_REQUESTS: 'my-requests',
  TRAVELLERS: 'travellers',
  ORGANIZER_DIRECTORY: 'organizer-directory',
} as const

export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, QK.LIST] as const,
  list: (filters: TripFilters) => [...tripKeys.lists(), filters] as const,
  details: () => [...tripKeys.all, QK.DETAIL] as const,
  detail: (slug: string) => [...tripKeys.details(), slug] as const,
  myTrips: (status?: string) => [...tripKeys.all, QK.MY, status] as const,
  myTripsSearch: (q: string, page: number, limit: number) => [...tripKeys.all, QK.MY, QK.SEARCH, q, page, limit] as const,
  bookedTripsSearch: (q: string, page: number, limit: number) => [...tripKeys.all, 'booked-search', q, page, limit] as const,
  adminTripsSearch: (q: string, page: number, limit: number) => [...tripKeys.all, QK.ADMIN, QK.SEARCH, q, page, limit] as const,
  editHistory: (id: string) => [...tripKeys.all, QK.HISTORY, id] as const,
}

export const uploadKeys = {
  all: ['uploads'] as const,
  signature: () => [...uploadKeys.all, QK.SIGNATURE] as const,
}

export const organizerKeys = {
  all: ['organizer'] as const,
  stats: () => [...organizerKeys.all, 'stats'] as const,
  publicProfile: (id: string, params?: { tripsPage?: number; reviewsPage?: number }) =>
    [...organizerKeys.all, QK.PUBLIC, id, params] as const,
}

export const bookingKeys = {
  all: ['bookings'] as const,
  myBookings: (filters?: MyBookingFilters) => [...bookingKeys.all, QK.MY, filters] as const,
  mySummary: () => [...bookingKeys.all, QK.MY, QK.SUMMARY] as const,
  detail: (id: string) => [...bookingKeys.all, QK.DETAIL, id] as const,
  myTripStatus: (tripId: string) => [...bookingKeys.all, QK.MY, QK.TRIP_STATUS, tripId] as const,
  forTrip: (tripId: string, filters?: TripBookingFilters) => [...bookingKeys.all, QK.TRIP, tripId, filters] as const,
  tripSummary: (tripId: string) => [...bookingKeys.all, QK.SUMMARY, tripId] as const,
}

export const tripRequestKeys = {
  all: ['tripRequests'] as const,
  forTrip: (tripId: string, filters?: TripRequestFilters) => [...tripRequestKeys.all, QK.TRIP, tripId, filters] as const,
  myRequests: () => [...tripRequestKeys.all, QK.MY] as const,
  allPending: () => [...tripRequestKeys.all, QK.ALL_PENDING] as const,
}

export const destinationKeys = {
  all: ['destinations'] as const,
  list: () => [...destinationKeys.all, QK.LIST] as const,
  popular: () => [...destinationKeys.all, QK.POPULAR] as const,
  details: () => [...destinationKeys.all, QK.DETAIL] as const,
  detail: (slug: string, params?: { page?: number; tripType?: string; sort?: string; minPrice?: number; maxPrice?: number }) =>
    [...destinationKeys.details(), slug, params] as const,
}

export const reviewKeys = {
  all: ['reviews'] as const,
  forTrip: (tripId: string, filters?: ReviewListFilters) =>
    [...reviewKeys.all, QK.TRIP, tripId, filters] as const,
  myForBooking: (bookingId: string) =>
    [...reviewKeys.all, QK.MY, QK.BOOKING, bookingId] as const,
  organizerMine: (filters?: OrganizerReviewFilters) =>
    [...reviewKeys.all, QK.ORGANIZER, QK.MINE, filters] as const,
  myReviews: (filters?: ReviewListFilters) =>
    [...reviewKeys.all, QK.MY, QK.ALL, filters] as const,
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters?: Record<string, unknown>) => [...notificationKeys.all, QK.LIST, filters] as const,
  unreadCount: () => [...notificationKeys.all, QK.UNREAD] as const,
}

export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, QK.ME] as const,
}

export const walletKeys = {
  all: ['wallet'] as const,
  balance: () => [...walletKeys.all, 'balance'] as const,
  transactions: (filters?: WalletTransactionFilters) =>
    [...walletKeys.all, QK.TRANSACTIONS, filters] as const,
  cashback: (page?: number) =>
    [...walletKeys.all, QK.CASHBACK, page] as const,
}

export const paymentKeys = {
  all: ['payments'] as const,
  myPayments: (filters?: PaymentHistoryFilters) =>
    [...paymentKeys.all, QK.MY, filters] as const,
  mySummary: () => [...paymentKeys.all, QK.MY, QK.SUMMARY] as const,
  tripPayments: (tripId: string, filters?: PaymentHistoryFilters) =>
    [...paymentKeys.all, QK.TRIP, tripId, filters] as const,
  tripSummary: (tripId: string) =>
    [...paymentKeys.all, QK.TRIP, tripId, QK.SUMMARY] as const,
  adminPayments: (filters?: AdminPaymentFilters) =>
    [...paymentKeys.all, QK.ADMIN, filters] as const,
  adminSummary: () => [...paymentKeys.all, QK.ADMIN, QK.SUMMARY] as const,
  organizerPayments: (filters?: OrganizerPaymentFilters) =>
    [...paymentKeys.all, QK.ORGANIZER, filters] as const,
  organizerSummary: () => [...paymentKeys.all, QK.ORGANIZER, QK.SUMMARY] as const,
}

export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, QK.CONVERSATIONS] as const,
  conversationList: (filters?: ConversationListFilters) =>
    [...chatKeys.conversations(), filters] as const,
  messages: (conversationId: string) =>
    [...chatKeys.all, QK.MESSAGES, conversationId] as const,
  messageSearch: (conversationId: string, query: string) =>
    [...chatKeys.all, QK.MESSAGES, conversationId, QK.SEARCH, query] as const,
  unreadCount: () => [...chatKeys.all, QK.UNREAD_COUNT] as const,
  flagged: (page?: number, limit?: number) =>
    [...chatKeys.all, QK.FLAGGED, page, limit] as const,
}

export const vehicleKeys = {
  all: ['vehicle'] as const,
  seatMap: (tripId: string) => [...vehicleKeys.all, QK.SEAT_MAP, tripId] as const,
  organizerSeatMap: (tripId: string) => [...vehicleKeys.all, QK.ORGANIZER_SEAT_MAP, tripId] as const,
  vehicle: (tripId: string) => [...vehicleKeys.all, QK.DETAIL, tripId] as const,
  vehicleList: (tripId: string) => [...vehicleKeys.all, QK.LIST, tripId] as const,
}

export const tripCategoryKeys = {
  all: ['tripCategories'] as const,
  active: () => [...tripCategoryKeys.all, QK.ACTIVE] as const,
  admin: () => [...tripCategoryKeys.all, QK.ADMIN] as const,
  requests: (filters?: { status?: string }) =>
    [...tripCategoryKeys.all, QK.REQUESTS, filters] as const,
  myRequests: () => [...tripCategoryKeys.all, QK.MY_REQUESTS] as const,
}

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  organizersBase: () => [...adminKeys.all, QK.ORGANIZERS] as const,
  organizers: (filters?: OrganizerApprovalFilters) =>
    filters
      ? [...adminKeys.organizersBase(), filters] as const
      : adminKeys.organizersBase(),
  organizerDetail: (id: string) =>
    [...adminKeys.organizersBase(), QK.DETAIL, id] as const,
  bookingsBase: () => [...adminKeys.all, QK.BOOKINGS] as const,
  bookings: (filters?: AdminBookingFilters) =>
    filters
      ? [...adminKeys.bookingsBase(), filters] as const
      : adminKeys.bookingsBase(),
  bookingDetail: (id: string) =>
    [...adminKeys.bookingsBase(), QK.DETAIL, id] as const,
  cashbackTripsBase: () => [...adminKeys.all, QK.CASHBACK, QK.TRIPS] as const,
  cashbackTrips: (filters?: CashbackTripFilters) =>
    [...adminKeys.cashbackTripsBase(), filters] as const,
  cashbackTripDetail: (tripId: string) =>
    [...adminKeys.cashbackTripsBase(), QK.DETAIL, tripId] as const,
  cashbackByUserBase: () => [...adminKeys.all, QK.CASHBACK, QK.BY_USER] as const,
  cashbackByUser: (filters?: CashbackHistoryFilters) =>
    [...adminKeys.cashbackByUserBase(), filters] as const,
  cashbackByTripBase: () => [...adminKeys.all, QK.CASHBACK, QK.BY_TRIP] as const,
  cashbackByTrip: (filters?: CashbackHistoryFilters) =>
    [...adminKeys.cashbackByTripBase(), filters] as const,
  cashbackUserDetail: (userId: string, filters?: CashbackHistoryFilters) =>
    [...adminKeys.cashbackByUserBase(), QK.DETAIL, userId, filters] as const,
  docReviewDetail: (organizerId: string) =>
    [...adminKeys.organizersBase(), QK.DOC_REVIEW, organizerId] as const,
  invitesBase: () => [...adminKeys.all, QK.INVITES] as const,
  invites: (filters?: OrganizerInviteFilters) =>
    filters ? [...adminKeys.invitesBase(), filters] as const : adminKeys.invitesBase(),
  tripsBase: () => [...adminKeys.all, QK.TRIPS] as const,
  trips: (filters?: { q?: string; page?: number }) =>
    filters ? [...adminKeys.tripsBase(), filters] as const : adminKeys.tripsBase(),
  reviewsBase: () => [...adminKeys.all, QK.REVIEWS] as const,
  reviews: (filters?: AdminReviewFilters) =>
    [...adminKeys.reviewsBase(), filters] as const,
  travellersBase: () => [...adminKeys.all, QK.TRAVELLERS] as const,
  travellers: (filters?: AdminTravellerFilters) =>
    [...adminKeys.travellersBase(), filters] as const,
  travellerDetail: (id: string, filters?: AdminTravellerDetailFilters) =>
    [...adminKeys.travellersBase(), QK.DETAIL, id, filters] as const,
  organizerDirectoryBase: () => [...adminKeys.all, QK.ORGANIZER_DIRECTORY] as const,
  organizerDirectory: (filters?: AdminOrganizerDirectoryFilters) =>
    [...adminKeys.organizerDirectoryBase(), filters] as const,
  organizerTripsDetail: (id: string, filters?: AdminOrganizerDetailFilters) =>
    [...adminKeys.organizerDirectoryBase(), QK.DETAIL, id, filters] as const,
}

export const docReviewKeys = {
  all: ['docReview'] as const,
  comments: () => [...docReviewKeys.all, 'comments'] as const,
}
