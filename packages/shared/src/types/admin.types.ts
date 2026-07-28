import type { PaginationMeta } from './api-response.types'
import type { VerificationStatus, ApproveRejectAction } from '../constants/verification-status'
import type { BookingStatusConst } from '../constants/booking-status'
import type { TripStatusConst } from '../constants/trip-types'
import type { SortOrder } from '../constants/sort'
export type { SortOrder } from '../constants/sort'
import type { AdminReviewSortBy, AdminBookingSortBy, AdminTripSortBy, AdminTravellerSort, AdminOrganizerSort, AdminTravellerStatus } from '../constants/admin'
export type { AdminReviewSortBy, AdminBookingSortBy, AdminTripSortBy, AdminTravellerSort, AdminOrganizerSort, AdminTravellerStatus } from '../constants/admin'
import type { OrganizerWalletTxType } from '../constants/wallet'

// ─── Document Review ────────────────────────────────────

export type DocumentReviewStatusType = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface DocumentReviewItem {
  id: string
  docType: string
  status: DocumentReviewStatusType
  currentUrl: string | null
  reviewedAt: string | null
  reviewedBy: string | null
}

export interface DocumentReviewCommentItem {
  id: string
  authorId: string
  authorName: string
  authorRole: string
  docType: string | null
  comment: string
  attachmentUrl: string | null
  createdAt: string
}

export interface ReviewDocDto {
  action: 'APPROVED' | 'REJECTED'
  comment?: string
}

export interface AddDocCommentDto {
  docType?: string
  comment: string
  attachmentUrl?: string
}

// ─── Organizer Approvals ────────────────────────────────

export type VerificationStatusFilter = VerificationStatus

export interface OrganizerApprovalItem {
  id: string
  userId: string
  businessName: string
  description: string | null
  documents: unknown
  verificationStatus: VerificationStatusFilter
  documentReviews?: DocumentReviewItem[]
  createdAt: string
  user: {
    id: string
    name: string
    email: string | null
    avatarUrl: string | null
  }
}

export interface OrganizerDocReviewDetail extends OrganizerApprovalItem {
  documentReviews: DocumentReviewItem[]
  reviewComments: DocumentReviewCommentItem[]
}

export interface OrganizerApprovalFilters {
  status?: VerificationStatusFilter
  page?: number
  limit?: number
}

export interface ApproveRejectDto {
  action: ApproveRejectAction
  reason?: string
}

export interface UpdateCommissionDto {
  commissionRate: number
}

// ─── Platform Stats ─────────────────────────────────────

export interface PlatformOverview {
  totalUsers: number
  totalOrganizers: number
  pendingApprovals: number
  totalTrips: number
  activeTrips: number
  totalBookings: number
  totalRevenue: number
  flaggedMessages: number
}

export interface RevenueTrendPoint {
  month: string
  revenue: number
}

export interface BookingStatusCount {
  status: string
  count: number
}

export interface TripTypeCount {
  type: string
  count: number
}

export interface PlatformStatsResponse {
  overview: PlatformOverview
  revenueTrend: RevenueTrendPoint[]
  bookingsByStatus: BookingStatusCount[]
  tripsByType: TripTypeCount[]
}

// ─── Admin Bookings / Disputes ──────────────────────────

export interface AdminBookingItem {
  id: string
  bookingRef: string
  totalAmount: number
  bookingStatus: string
  numTravelers: number
  createdAt: string
  trip: {
    id: string
    title: string
    slug: string
    startDate: string
    endDate: string
  }
  user: {
    id: string
    name: string
    email: string | null
  }
}

export interface AdminBookingFilters {
  status?: BookingStatusConst
  search?: string
  tripId?: string
  sortBy?: AdminBookingSortBy
  sortOrder?: SortOrder
  page?: number
  limit?: number
}

export interface AdminTripFilters {
  q?: string
  status?: string
  sortBy?: AdminTripSortBy
  sortOrder?: SortOrder
  page?: number
  limit?: number
}

export interface AdminBookingDetail extends AdminBookingItem {
  cancellationReason: string | null
  cancelledAt: string | null
  walletAmount: number
  travelerDetails: Array<{
    id: string
    name: string
    phone: string | null
    age: number | null
    gender: string | null
    isPrimary: boolean
    assignedSeat?: {
      seatNumber: number
      seatLabel: string
      vehicleName: string
    } | null
  }>
  paymentTransactions: Array<{
    id: string
    type: string
    status: string
    amount: number
    createdAt: string
    razorpayPaymentId: string | null
    razorpayRefundId: string | null
  }>
}

export interface AdminBookingListResponse {
  data: AdminBookingItem[]
  pagination: PaginationMeta
}

export interface OrganizerApprovalListResponse {
  data: OrganizerApprovalItem[]
  pagination: PaginationMeta
}

// ─── Admin Cashback ─────────────────────────────────────

export interface CompletedTripForCashback {
  id: string
  title: string
  slug: string
  startDate: string
  endDate: string
  currentBookings: number
  cashbackStats: {
    issuedCount: number
    totalAmount: number
  }
}

export interface CashbackTravelerItem {
  bookingId: string
  userId: string
  userName: string
  email: string | null
  totalAmount: number
  numTravelers: number
  cashbackIssued: number | null
  issuedAt: string | null
}

export interface IssueCashbackDto {
  tripId: string
  items: Array<{
    bookingId: string
    userId: string
    amount: number
  }>
}

export interface IssueCashbackResponse {
  issued: number
  totalAmount: number
}

export interface CashbackHistoryByUser {
  userId: string
  userName: string
  email: string | null
  totalCashback: number
  count: number
  latestIssuedAt: string
}

export interface CashbackHistoryByTrip {
  tripId: string
  tripTitle: string
  startDate: string
  endDate: string
  totalCashback: number
  travelerCount: number
}

export interface CashbackUserTripDetail {
  bookingId: string
  tripTitle: string
  bookingAmount: number
  amount: number
  issuedAt: string
}

export interface CashbackTripFilters {
  search?: string
  page?: number
  limit?: number
}

export interface CashbackHistoryFilters {
  page?: number
  limit?: number
}

// ─── Organizer Invites ──────────────────────────────────

export type OrganizerInviteStatus = 'pending' | 'accepted'

export interface OrganizerInviteItem {
  id: string
  email: string
  sentAt: string
  acceptedAt: string | null
  sentBy: string | null
  sentByUser: { id: string; name: string; email: string | null } | null
}

export interface OrganizerInviteFilters {
  status?: OrganizerInviteStatus
  page?: number
  limit?: number
}

// ─── Admin Reviews ──────────────────────────────────────

export interface AdminReviewFilters {
  organizerSearch?: string
  tripSearch?: string
  tripId?: string
  rating?: number
  sortBy?: AdminReviewSortBy
  sortOrder?: SortOrder
  page?: number
  limit?: number
}

export interface AdminReviewItem {
  id: string
  overallRating: number
  comment?: string | null
  photos: string[]
  organizerReply?: string | null
  editedAt?: string | null
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string | null }
  trip: {
    id: string
    title: string
    slug: string
    organizer: { businessName: string }
  }
}

// ─── Admin User Directory ───────────────────────────────

export interface AdminTravellerFilters {
  search?: string
  status?: AdminTravellerStatus
  sortBy?: AdminTravellerSort
  sortOrder?: SortOrder
  page?: number
  limit?: number
}

export interface AdminTravellerListItem {
  id: string
  name: string
  email: string | null
  phone: string | null
  bookingsCount: number
  joinedAt: string
}

/** Filters the booked-trips sub-list on GET /admin/users/travellers/:travellerId */
export interface AdminTravellerDetailFilters {
  status?: BookingStatusConst
  page?: number
  limit?: number
}

export interface AdminTravellerDetail {
  user: {
    id: string
    name: string
    email: string | null
    phone: string | null
    avatarUrl: string | null
    bookingsCount: number
    createdAt: string
  }
  trips: {
    data: AdminBookingItem[]
    pagination: PaginationMeta
  }
  reviews: {
    data: Array<{
      id: string
      overallRating: number
      comment?: string | null
      createdAt: string
      trip: { title: string; slug: string }
    }>
    total: number
  }
}

export interface AdminOrganizerDirectoryFilters {
  search?: string
  status?: VerificationStatusFilter
  sortBy?: AdminOrganizerSort
  sortOrder?: SortOrder
  page?: number
  limit?: number
}

export interface AdminOrganizerDirectoryItem {
  id: string
  name: string
  email: string | null
  phone: string | null
  businessName: string
  tripsCount: number
  joinedAt: string
}

/** Filters the trips-created sub-list on GET /admin/users/organizers/:organizerId */
export interface AdminOrganizerDetailFilters {
  status?: TripStatusConst
  page?: number
  limit?: number
}

export interface AdminOrganizerTripItem {
  id: string
  title: string
  slug: string
  status: string
  pricePerPerson: number
  currentBookings: number
  maxGroupSize: number
  startDate: string
  endDate: string
  createdAt: string
}

export interface AdminOrganizerTripsDetail {
  organizer: {
    id: string
    businessName: string
    email: string | null
    phone: string | null
    verificationStatus: VerificationStatusFilter
    tripsCount: number
    createdAt: string
    /** Organizer's CURRENT commissionRate (live, not a per-trip frozen snapshot). */
    commissionRate: number
  }
  trips: {
    data: AdminOrganizerTripItem[]
    pagination: PaginationMeta
  }
}

// ─── Organizer Payouts (RazorpayX Payouts strategy) ──────────────────────
// See docs/codebase/Payments & Webhooks.md "Organizer earnings via Wallet ledger".

/** GET /admin/payouts/pending — one row per organizer with a positive Wallet balance */
export interface AdminPendingPayoutItem {
  organizerId: string
  businessName: string
  userId: string
  userName: string
  email: string | null
  balance: number
  currency: string
  hasFundAccount: boolean
  /** True if this organizer has a SUCCEEDED RazorpayX payout attempt that was never
   *  followed by a matching wallet debit — the balance above still includes money
   *  already sent; needs manual reconciliation before any further payout is released. */
  hasUnreconciledPayout: boolean
}

/** Query params for GET /admin/payouts/pending */
export interface AdminPendingPayoutFilters {
  page?: number
  limit?: number
}

/** Paginated response shape for GET /admin/payouts/pending */
export interface AdminPendingPayoutsResponse {
  data: AdminPendingPayoutItem[]
  pagination: PaginationMeta
}

/** Filters query params for GET /admin/payouts */
export interface AdminPayoutHistoryFilters {
  organizerId?: string
  /** Narrows to a single organizer-ledger transaction type (one of the four
   *  ORGANIZER_* types — see ORGANIZER_WALLET_TX_TYPES). Unset = all four types. */
  type?: OrganizerWalletTxType
  page?: number
  limit?: number
}

/** Single row in GET /admin/payouts — one WalletTransaction, enriched with organizer name */
export interface AdminPayoutHistoryItem {
  id: string
  organizerId: string | null
  organizerName: string
  amount: number
  type: string
  referenceModel: string | null
  referenceId: string | null
  description: string
  balanceBefore: number
  balanceAfter: number
  createdAt: string
}

/** Body for POST /admin/payouts/:organizerId/release */
export interface ReleasePayoutDto {
  /** Amount to release, in whole rupees (matches Wallet.balance's unit). Omitted = full balance. */
  amount?: number
}

/** Response for POST /admin/payouts/:organizerId/release */
export interface ReleasePayoutResult {
  /**
   * 'ledger_mismatch': the RazorpayX payout succeeded (real money left the platform) but
   * the wallet-ledger debit that should follow it threw — the organizer's displayed
   * balance is now out of sync with reality and needs manual reconciliation. Distinct
   * from 'released' (clean success) and 'failed' (no money moved at all).
   */
  status: 'released' | 'insufficient_balance' | 'failed' | 'ledger_mismatch'
  releasedAmount: number
  payoutId?: string
}
