'use client'

import { useState } from 'react'
import { TripStatsBar, TripStatsBarSkeleton } from '@/components/dashboard/trip-users/trip-stats-bar'
import { BookingCard, RequestCard, ParticipantCardSkeleton } from '@/components/dashboard/trip-users/participant-card'
import { ParticipantDrawer } from '@/components/dashboard/trip-users/participant-drawer'
import { RequestActionModal } from '@/components/dashboard/trip-users/request-action-modal'
import { ParticipantFilters } from '@/components/dashboard/trip-users/participant-filters'
import { Tabs } from '@/components/shared/tabs'
import type { TripBookingListItem } from '@shared/types/booking.types'
import type { TripRequestListItem } from '@shared/types/trip-request.types'

// ── Mock Data ────────────────────────────────────────────

const MOCK_SUMMARY = {
  confirmedCount: 8,
  totalTravelers: 22,
  seatsLeft: 8,
  maxGroupSize: 30,
  revenue: 135000,
  pendingRequestsCount: 3,
}

const MOCK_BOOKINGS: TripBookingListItem[] = [
  {
    id: 'b1',
    bookingRef: 'BK-20260101-ABC',
    bookingStatus: 'CONFIRMED',
    numTravelers: 3,
    totalAmount: 13500,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    user: { id: 'u1', name: 'Rahul Sharma', email: 'rahul@example.com', avatarUrl: null },
    travelerDetails: [
      { id: 't1', name: 'Rahul Sharma', phone: '9876543210', phoneVerified: true, age: 28, gender: 'Male', isPrimary: true, emergencyContactName: 'Mom', emergencyContactPhone: '9000000001' },
      { id: 't2', name: 'Priya Sharma', phone: '9876543211', phoneVerified: true, age: 26, gender: 'Female', isPrimary: false, emergencyContactName: null, emergencyContactPhone: null },
      { id: 't3', name: 'Amit Sharma', phone: null, phoneVerified: false, age: 30, gender: 'Male', isPrimary: false, emergencyContactName: null, emergencyContactPhone: null },
    ],
  },
  {
    id: 'b2',
    bookingRef: 'BK-20260102-DEF',
    bookingStatus: 'CONFIRMED',
    numTravelers: 2,
    totalAmount: 9000,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    user: { id: 'u2', name: 'Neha Patel', email: 'neha.patel@example.com', avatarUrl: null },
    travelerDetails: [
      { id: 't4', name: 'Neha Patel', phone: '9123456789', phoneVerified: true, age: 25, gender: 'Female', isPrimary: true, emergencyContactName: null, emergencyContactPhone: null },
      { id: 't5', name: 'Rohan Patel', phone: '9123456780', phoneVerified: true, age: 27, gender: 'Male', isPrimary: false, emergencyContactName: null, emergencyContactPhone: null },
    ],
  },
  {
    id: 'b3',
    bookingRef: 'BK-20260103-GHI',
    bookingStatus: 'PENDING_PAYMENT',
    numTravelers: 1,
    totalAmount: 4500,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    user: { id: 'u3', name: 'Vikram Singh', email: 'vikram@example.com', avatarUrl: null },
    travelerDetails: [
      { id: 't6', name: 'Vikram Singh', phone: '9988776655', phoneVerified: true, age: 32, gender: 'Male', isPrimary: true, emergencyContactName: null, emergencyContactPhone: null },
    ],
  },
  {
    id: 'b4',
    bookingRef: 'BK-20260104-JKL',
    bookingStatus: 'CANCELLED',
    numTravelers: 4,
    totalAmount: 18000,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    user: { id: 'u4', name: 'Sneha Gupta', email: 'sneha.g@example.com', avatarUrl: null },
    travelerDetails: [],
  },
]

const MOCK_REQUESTS: TripRequestListItem[] = [
  {
    id: 'r1',
    numTravelers: 4,
    message: 'We are a group of college friends, super excited for this trip!',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    respondedAt: null,
    responseNote: null,
    approvalExpiresAt: null,
    user: { id: 'u5', name: 'Ananya Reddy', email: 'ananya@example.com', avatarUrl: null },
    travelerDetails: null,
  },
  {
    id: 'r2',
    numTravelers: 2,
    message: 'Looking forward to joining!',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    respondedAt: null,
    responseNote: null,
    approvalExpiresAt: null,
    user: { id: 'u6', name: 'Karthik Menon', email: 'karthik.m@example.com', avatarUrl: null },
    travelerDetails: null,
  },
  {
    id: 'r3',
    numTravelers: 1,
    message: null,
    status: 'PENDING',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    respondedAt: null,
    responseNote: null,
    approvalExpiresAt: null,
    user: { id: 'u7', name: 'Deepika Nair', email: 'deepika@example.com', avatarUrl: null },
    travelerDetails: null,
  },
  {
    id: 'r4',
    numTravelers: 2,
    message: 'Can we bring pets?',
    status: 'APPROVED',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    responseNote: 'Welcome aboard!',
    approvalExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    user: { id: 'u8', name: 'Arjun Desai', email: 'arjun.d@example.com', avatarUrl: null },
    travelerDetails: null,
  },
  {
    id: 'r5',
    numTravelers: 6,
    message: 'Large group — is there a discount?',
    status: 'REJECTED',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    responseNote: 'Sorry, not enough seats for a group of 6.',
    approvalExpiresAt: null,
    user: { id: 'u9', name: 'Meera Joshi', email: 'meera.j@example.com', avatarUrl: null },
    travelerDetails: null,
  },
]

// ── Preview Page ─────────────────────────────────────────

type DrawerItem =
  | { type: 'booking'; data: TripBookingListItem }
  | { type: 'request'; data: TripRequestListItem }

export default function TripUsersPreview() {
  const [activeTab, setActiveTab] = useState('requests')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [drawerItem, setDrawerItem] = useState<DrawerItem | null>(null)
  const [actionRequest, setActionRequest] = useState<TripRequestListItem | null>(null)
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [showSkeleton, setShowSkeleton] = useState(false)

  const tabItems = [
    { label: `New Requests (${MOCK_REQUESTS.filter(r => r.status === 'PENDING').length})`, value: 'requests' },
    { label: `Confirmed (${MOCK_BOOKINGS.filter(b => b.bookingStatus === 'CONFIRMED').length})`, value: 'confirmed' },
    { label: 'All Bookings', value: 'all' },
  ]

  const filteredBookings = MOCK_BOOKINGS.filter((b) => {
    if (activeTab === 'confirmed' && b.bookingStatus !== 'CONFIRMED') return false
    if (status && b.bookingStatus !== status) return false
    if (search && !b.user.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredRequests = MOCK_REQUESTS.filter((r) => {
    if (status && r.status !== status) return false
    if (search && !r.user.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const statusOptions = activeTab === 'requests'
    ? [{ label: 'Pending', value: 'PENDING' }, { label: 'Approved', value: 'APPROVED' }, { label: 'Rejected', value: 'REJECTED' }]
    : [{ label: 'Confirmed', value: 'CONFIRMED' }, { label: 'Pending', value: 'PENDING' }, { label: 'Cancelled', value: 'CANCELLED' }]

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-neutral-900">
            Participants — Goa Beach Getaway
          </h2>
          <button
            onClick={() => setShowSkeleton(!showSkeleton)}
            className="btn-ghost text-xs"
          >
            {showSkeleton ? 'Show Data' : 'Show Skeletons'}
          </button>
        </div>

        {/* Stats Bar */}
        {showSkeleton ? <TripStatsBarSkeleton /> : <TripStatsBar summary={MOCK_SUMMARY} />}

        {/* Tabs */}
        <Tabs items={tabItems} value={activeTab} onChange={(v) => { setActiveTab(v); setSearch(''); setStatus('') }} />

        {/* Filters */}
        <ParticipantFilters
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          statusOptions={statusOptions}
        />

        {/* Cards */}
        {showSkeleton ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <ParticipantCardSkeleton key={i} />)}
          </div>
        ) : activeTab === 'requests' ? (
          <div className="space-y-3">
            {filteredRequests.length === 0 ? (
              <p className="py-12 text-center text-neutral-400">No requests found.</p>
            ) : (
              filteredRequests.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  onApprove={() => { setActionRequest(r); setActionType('APPROVED') }}
                  onReject={() => { setActionRequest(r); setActionType('REJECTED') }}
                  onViewDetails={() => setDrawerItem({ type: 'request', data: r })}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookings.length === 0 ? (
              <p className="py-12 text-center text-neutral-400">No bookings found.</p>
            ) : (
              filteredBookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onViewDetails={() => setDrawerItem({ type: 'booking', data: b })}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Drawer */}
      <ParticipantDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />

      {/* Action Modal */}
      <RequestActionModal
        request={actionRequest}
        action={actionType}
        onConfirm={(id, action, note) => {
          alert(`Action: ${action}\nRequest: ${id}\nNote: ${note ?? '(none)'}`)
          setActionRequest(null)
          setActionType(null)
        }}
        onClose={() => { setActionRequest(null); setActionType(null) }}
        isPending={false}
        seatsLeft={MOCK_SUMMARY.seatsLeft}
      />
    </div>
  )
}
