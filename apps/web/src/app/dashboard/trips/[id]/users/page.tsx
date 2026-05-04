'use client'

import { useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Tabs } from '@/components/shared/tabs'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { TripStatsBar, TripStatsBarSkeleton } from '@/components/dashboard/trip-users/trip-stats-bar'
import { BookingCard, RequestCard, ParticipantCardSkeleton } from '@/components/dashboard/trip-users/participant-card'
import { ParticipantDrawer } from '@/components/dashboard/trip-users/participant-drawer'
import { RequestActionModal } from '@/components/dashboard/trip-users/request-action-modal'
import { ParticipantFilters } from '@/components/dashboard/trip-users/participant-filters'
import { useTripBookings } from '@/hooks/use-trip-bookings'
import { useTripRequests } from '@/hooks/use-trip-requests'
import { useTripSummary } from '@/hooks/use-trip-summary'
import { useRespondToRequest } from '@/hooks/use-respond-request'
import type { TripBookingListItem, BookingStatus } from '@shared/types/booking.types'
import type { TripRequestListItem, TripRequestStatus } from '@shared/types/trip-request.types'

const BOOKING_STATUS_OPTIONS = [
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Pending Payment', value: 'PENDING_PAYMENT' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Refunded', value: 'REFUNDED' },
]

const REQUEST_STATUS_OPTIONS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Expired', value: 'EXPIRED' },
]

type DrawerItem =
  | { type: 'booking'; data: TripBookingListItem }
  | { type: 'request'; data: TripRequestListItem }

export default function TripUsersPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const tripId = params.id
  const tripName = searchParams.get('name')

  // ── Tab + Filter state ──────────────────────────────
  const [activeTab, setActiveTab] = useState('requests')
  const [bookingSearch, setBookingSearch] = useState('')
  const [bookingStatus, setBookingStatus] = useState('')
  const [bookingPage, setBookingPage] = useState(1)
  const [requestSearch, setRequestSearch] = useState('')
  const [requestStatus, setRequestStatus] = useState('')
  const [requestPage, setRequestPage] = useState(1)

  // ── Drawer + Modal state ────────────────────────────
  const [drawerItem, setDrawerItem] = useState<DrawerItem | null>(null)
  const [actionRequest, setActionRequest] = useState<TripRequestListItem | null>(null)
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null)

  // ── Data hooks ──────────────────────────────────────
  const summary = useTripSummary(tripId)
  const bookingStatusFilter = activeTab === 'confirmed'
    ? (['CONFIRMED', 'COMPLETED'] as BookingStatus[])
    : (bookingStatus || undefined) as BookingStatus | undefined
  const bookings = useTripBookings(tripId, {
    search: bookingSearch || undefined,
    bookingStatus: bookingStatusFilter,
    page: bookingPage,
    limit: 20,
  })
  const requests = useTripRequests(tripId, {
    search: requestSearch || undefined,
    status: (requestStatus || undefined) as TripRequestStatus | undefined,
    page: requestPage,
    limit: 20,
  })
  const respondMutation = useRespondToRequest()

  // ── Callbacks ───────────────────────────────────────
  const handleBookingSearchChange = useCallback((v: string) => { setBookingSearch(v); setBookingPage(1) }, [])
  const handleBookingStatusChange = useCallback((v: string) => { setBookingStatus(v); setBookingPage(1) }, [])
  const handleRequestSearchChange = useCallback((v: string) => { setRequestSearch(v); setRequestPage(1) }, [])
  const handleRequestStatusChange = useCallback((v: string) => { setRequestStatus(v); setRequestPage(1) }, [])

  const handleApprove = (req: TripRequestListItem) => {
    setActionRequest(req)
    setActionType('APPROVED')
  }
  const handleReject = (req: TripRequestListItem) => {
    setActionRequest(req)
    setActionType('REJECTED')
  }
  const handleConfirmAction = (requestId: string, action: 'APPROVED' | 'REJECTED', note?: string) => {
    respondMutation.mutate(
      { tripId, requestId, status: action, rejectionReason: note },
      {
        onSuccess: () => {
          setActionRequest(null)
          setActionType(null)
        },
      },
    )
  }

  // ── Tab items with badge counts ─────────────────────
  const pendingCount = summary.data?.pendingRequestsCount ?? 0
  const confirmedCount = summary.data?.confirmedCount ?? 0
  const tabItems = [
    { label: `Pending Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`, value: 'requests' },
    { label: `Paid & Booked${confirmedCount > 0 ? ` (${confirmedCount})` : ''}`, value: 'confirmed' },
    { label: 'All Bookings', value: 'all' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/trips" className="btn-ghost p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-bold text-neutral-900">
            Participants{tripName ? ` — ${tripName}` : ''}
          </h2>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">Trip ID: {tripId}</p>
        </div>
      </div>

      {/* Stats Bar */}
      {summary.isLoading ? (
        <TripStatsBarSkeleton />
      ) : summary.error ? (
        <ErrorState onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <TripStatsBar summary={summary.data} />
      ) : null}

      {/* Tabs */}
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />

      {/* Filters + List */}
      {activeTab === 'requests' && (
        <RequestsTab
          search={requestSearch}
          status={requestStatus}
          onSearchChange={handleRequestSearchChange}
          onStatusChange={handleRequestStatusChange}
          data={requests.data?.data}
          pagination={requests.data?.pagination}
          isLoading={requests.isLoading}
          error={requests.error}
          onRetry={() => requests.refetch()}
          onApprove={handleApprove}
          onReject={handleReject}
          onViewDetails={(r) => setDrawerItem({ type: 'request', data: r })}
          isResponding={respondMutation.isPending}
          page={requestPage}
          onPageChange={setRequestPage}
        />
      )}

      {activeTab === 'confirmed' && (
        <BookingsTab
          search={bookingSearch}
          status="CONFIRMED"
          onSearchChange={handleBookingSearchChange}
          onStatusChange={() => {}}
          statusOptions={[]}
          hideStatusFilter
          data={bookings.data?.data}
          pagination={bookings.data?.pagination}
          isLoading={bookings.isLoading}
          error={bookings.error}
          onRetry={() => bookings.refetch()}
          onViewDetails={(b) => setDrawerItem({ type: 'booking', data: b })}
          page={bookingPage}
          onPageChange={setBookingPage}
        />
      )}

      {activeTab === 'all' && (
        <BookingsTab
          search={bookingSearch}
          status={bookingStatus}
          onSearchChange={handleBookingSearchChange}
          onStatusChange={handleBookingStatusChange}
          statusOptions={BOOKING_STATUS_OPTIONS}
          data={bookings.data?.data}
          pagination={bookings.data?.pagination}
          isLoading={bookings.isLoading}
          error={bookings.error}
          onRetry={() => bookings.refetch()}
          onViewDetails={(b) => setDrawerItem({ type: 'booking', data: b })}
          page={bookingPage}
          onPageChange={setBookingPage}
        />
      )}

      {/* Drawer */}
      <ParticipantDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />

      {/* Action Modal */}
      <RequestActionModal
        request={actionRequest}
        action={actionType}
        onConfirm={handleConfirmAction}
        onClose={() => { setActionRequest(null); setActionType(null) }}
        isPending={respondMutation.isPending}
        seatsLeft={summary.data?.seatsLeft}
      />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────

function BookingsTab({
  search,
  status,
  onSearchChange,
  onStatusChange,
  statusOptions,
  hideStatusFilter,
  data,
  pagination,
  isLoading,
  error,
  onRetry,
  onViewDetails,
  page,
  onPageChange,
}: {
  search: string
  status: string
  onSearchChange: (v: string) => void
  onStatusChange: (v: string) => void
  statusOptions: { label: string; value: string }[]
  hideStatusFilter?: boolean
  data?: TripBookingListItem[]
  pagination?: { page: number; limit: number; total: number; totalPages: number }
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  onViewDetails: (b: TripBookingListItem) => void
  page: number
  onPageChange: (p: number) => void
}) {
  return (
    <div className="space-y-4">
      {!hideStatusFilter && (
        <ParticipantFilters
          search={search}
          onSearchChange={onSearchChange}
          status={status}
          onStatusChange={onStatusChange}
          statusOptions={statusOptions}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <ParticipantCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <ErrorState onRetry={onRetry} />
      ) : !data || data.length === 0 ? (
        <EmptyState message="No bookings found." />
      ) : (
        <>
          <div className="space-y-3">
            {data.map((b) => (
              <BookingCard key={b.id} booking={b} onViewDetails={onViewDetails} />
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </div>
  )
}

function RequestsTab({
  search,
  status,
  onSearchChange,
  onStatusChange,
  data,
  pagination,
  isLoading,
  error,
  onRetry,
  onApprove,
  onReject,
  onViewDetails,
  isResponding,
  page,
  onPageChange,
}: {
  search: string
  status: string
  onSearchChange: (v: string) => void
  onStatusChange: (v: string) => void
  data?: TripRequestListItem[]
  pagination?: { page: number; limit: number; total: number; totalPages: number }
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  onApprove: (r: TripRequestListItem) => void
  onReject: (r: TripRequestListItem) => void
  onViewDetails: (r: TripRequestListItem) => void
  isResponding: boolean
  page: number
  onPageChange: (p: number) => void
}) {
  return (
    <div className="space-y-4">
      <ParticipantFilters
        search={search}
        onSearchChange={onSearchChange}
        status={status}
        onStatusChange={onStatusChange}
        statusOptions={REQUEST_STATUS_OPTIONS}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <ParticipantCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <ErrorState onRetry={onRetry} />
      ) : !data || data.length === 0 ? (
        <EmptyState message="No trip requests found." />
      ) : (
        <>
          <div className="space-y-3">
            {data.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                onApprove={onApprove}
                onReject={onReject}
                onViewDetails={onViewDetails}
                isResponding={isResponding}
              />
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (p: number) => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
      <p className="text-sm text-neutral-500">{total} total</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-ghost p-2 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-neutral-700">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-ghost p-2 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
