'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MyBookingTab, MyBookingListItem } from '@shared/types/booking.types'
import { useMyBookings } from '@/hooks/use-my-bookings'
import { useMyBookingSummary } from '@/hooks/use-my-booking-summary'
import { useMyPendingRequests } from '@/hooks/use-my-pending-requests'
import { Tabs } from '@/components/shared/tabs'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { MyBookingCard } from './my-booking-card'
import { PendingPaymentCard } from './pending-payment-card'
import { CancelBookingModal } from './cancel-booking-modal'
import { ReviewFormModal } from './review-form-modal'
import { useMyReviewForBooking } from '@/hooks/use-reviews'

const TAB_EMPTY_MESSAGES: Record<MyBookingTab, string> = {
  all: "You haven't booked any trips yet.",
  upcoming: 'No upcoming trips. Time to plan one!',
  payment_pending: 'No trip requests yet. Request to join a trip!',
  completed: 'No completed trips yet.',
  cancelled: 'No cancelled bookings.',
}

export function MyBookingsList() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<MyBookingTab>('all')
  const [page, setPage] = useState(1)
  const [cancelTarget, setCancelTarget] = useState<MyBookingListItem | null>(null)
  const [reviewTarget, setReviewTarget] = useState<MyBookingListItem | null>(null)
  const {
    data: existingReview,
    isLoading: isLoadingReview,
  } = useMyReviewForBooking(reviewTarget?.hasReview ? reviewTarget.id : undefined)

  const isPendingTab = activeTab === 'payment_pending'
  const filters = { tab: activeTab === 'all' ? undefined : activeTab, page }
  const { data, isLoading, error, refetch } = useMyBookings(filters, !isPendingTab)
  const pendingQuery = useMyPendingRequests(isPendingTab)
  const { data: summary } = useMyBookingSummary()

  const tabItems = [
    { label: `All (${summary?.all ?? 0})`, value: 'all' },
    { label: `Upcoming (${summary?.upcoming ?? 0})`, value: 'upcoming' },
    { label: `Requests (${summary?.paymentPending ?? 0})`, value: 'payment_pending' },
    { label: `Completed (${summary?.completed ?? 0})`, value: 'completed' },
    { label: `Cancelled (${summary?.cancelled ?? 0})`, value: 'cancelled' },
  ]

  const handleTabChange = (value: string) => {
    setActiveTab(value as MyBookingTab)
    setPage(1)
  }

  // ── Payment Pending tab — separate data source (C3 fix) ──
  const handlePayNow = (request: { id: string; numTravelers: number; travelerDetails: unknown; trip: { slug: string } }) => {
    // Store traveler details from approved request for pre-fill on booking page
    if (request.travelerDetails) {
      sessionStorage.setItem(`request-travelers-${request.id}`, JSON.stringify(request.travelerDetails))
    }
    router.push(`/trips/${request.trip.slug}/book?requestId=${request.id}&numTravelers=${request.numTravelers}`)
  }

  // ── 4-state rendering ──

  const activeLoading = isPendingTab ? pendingQuery.isLoading : isLoading
  const activeError = isPendingTab ? pendingQuery.error : error
  const activeRefetch = isPendingTab ? pendingQuery.refetch : refetch

  if (activeLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-full max-w-md rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-3 md:flex-row md:gap-4 md:p-4">
            <div className="skeleton h-40 w-full flex-shrink-0 rounded-lg md:h-28 md:w-40" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-4 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activeError) {
    return <ErrorState title="Couldn't load bookings" message={activeError.message} onRetry={activeRefetch} />
  }

  const bookings = data?.data ?? []
  const pendingRequests = pendingQuery.data ?? []
  const pagination = data?.pagination

  const isEmpty = isPendingTab ? pendingRequests.length === 0 : bookings.length === 0

  return (
    <div>
      {/* Tabs — mobile: scrollable, desktop: fit */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
        <Tabs
          items={tabItems}
          value={activeTab}
          onChange={handleTabChange}
          className="mb-4 min-w-max md:mb-6 md:min-w-0"
        />
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <EmptyState
          message={TAB_EMPTY_MESSAGES[activeTab]}
          action={
            activeTab === 'all' ? (
              <Link href="/trips" className="btn-primary inline-block rounded-lg px-5 py-2.5 text-sm font-medium">
                Browse Trips
              </Link>
            ) : undefined
          }
        />
      ) : isPendingTab ? (
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <PendingPaymentCard
              key={request.id}
              request={request}
              onPayNow={handlePayNow}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Booking cards */}
          <div className="space-y-4">
            {bookings.map((booking) => (
              <MyBookingCard
                key={booking.id}
                booking={booking}
                onCancel={setCancelTarget}
                onReview={setReviewTarget}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <CancelBookingModal
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
        />
      )}

      {/* Review modal — wait for existing review to load when editing */}
      {reviewTarget && reviewTarget.hasReview && isLoadingReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setReviewTarget(null)}
        >
          <div className="spinner h-8 w-8" />
        </div>
      )}
      {reviewTarget && (!reviewTarget.hasReview || !isLoadingReview) && (
        <ReviewFormModal
          bookingId={reviewTarget.id}
          tripId={reviewTarget.trip.id}
          tripTitle={reviewTarget.trip.title}
          onClose={() => setReviewTarget(null)}
          existingReview={reviewTarget.hasReview ? existingReview : null}
        />
      )}
    </div>
  )
}
