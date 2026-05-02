'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MyBookingTab, MyBookingListItem } from '@shared/types/booking.types'
import { useMyBookings } from '@/hooks/use-my-bookings'
import { useMyBookingSummary } from '@/hooks/use-my-booking-summary'
import { Tabs } from '@/components/shared/tabs'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { MyBookingCard } from './my-booking-card'
import { CancelBookingModal } from './cancel-booking-modal'

const TAB_EMPTY_MESSAGES: Record<MyBookingTab, string> = {
  all: "You haven't booked any trips yet.",
  upcoming: 'No upcoming trips. Time to plan one!',
  completed: 'No completed trips yet.',
  cancelled: 'No cancelled bookings.',
}

export function MyBookingsList() {
  const [activeTab, setActiveTab] = useState<MyBookingTab>('all')
  const [page, setPage] = useState(1)
  const [cancelTarget, setCancelTarget] = useState<MyBookingListItem | null>(null)

  const filters = { tab: activeTab === 'all' ? undefined : activeTab, page }
  const { data, isLoading, isError, refetch } = useMyBookings(filters)
  const { data: summary } = useMyBookingSummary()

  const tabItems = [
    { label: `All (${summary?.all ?? 0})`, value: 'all' },
    { label: `Upcoming (${summary?.upcoming ?? 0})`, value: 'upcoming' },
    { label: `Completed (${summary?.completed ?? 0})`, value: 'completed' },
    { label: `Cancelled (${summary?.cancelled ?? 0})`, value: 'cancelled' },
  ]

  const handleTabChange = (value: string) => {
    setActiveTab(value as MyBookingTab)
    setPage(1)
  }

  // ── 4-state rendering ──

  if (isLoading) {
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

  if (isError) {
    return <ErrorState title="Couldn't load bookings" onRetry={refetch} />
  }

  const bookings = data?.data ?? []
  const pagination = data?.pagination

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
      {bookings.length === 0 ? (
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
      ) : (
        <>
          {/* Booking cards */}
          <div className="space-y-4">
            {bookings.map((booking) => (
              <MyBookingCard
                key={booking.id}
                booking={booking}
                onCancel={setCancelTarget}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-outline px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="btn-outline px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
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
    </div>
  )
}
