import type { PaginationMeta } from './api-response.types'
import type { VerificationStatus, ApproveRejectAction } from '../constants/verification-status'
import type { BookingStatusConst } from '../constants/booking-status'

// ─── Organizer Approvals ────────────────────────────────

export type VerificationStatusFilter = VerificationStatus

export interface OrganizerApprovalItem {
  id: string
  userId: string
  businessName: string
  description: string | null
  documents: unknown
  verificationStatus: VerificationStatusFilter
  createdAt: string
  user: {
    id: string
    name: string
    email: string | null
    avatarUrl: string | null
  }
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
