'use client'

import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import { formatCurrency } from '@/lib/format'
import type { BookingRow } from '@/hooks/use-reseller'
import { RESELLER_BOOKING_REFUND_STATUS } from '@shared/constants/reseller'

/**
 * Renders the "bookings via this link" feed for a reseller main-link/sublink.
 *
 * Deviation from the reseller plan: the plan called for reusing `PaymentTransactionList`
 * here, but `GET /reseller/main-links/:id/bookings` and `GET /reseller/sublinks/:id/bookings`
 * (apps/api/src/repositories/reseller.repository.ts BOOKING_SELECT) return raw Booking rows
 * (bookingRef, numTravelers, totalAmount, markupAmount, bookingStatus, user) — not
 * PaymentHistoryItem rows (type/status/razorpayPaymentId/booking.trip). The shapes are
 * incompatible, so `PaymentTransactionList` cannot be passed this data as-is. This is a
 * new, small, reusable component instead — shared across the organizer/reseller/admin
 * reseller pages exactly like a `TripListCard`/`PaymentTransactionList` would be.
 */
/** Second badge alongside the raw `bookingStatus` badge, showing refund progress — see `BookingRow.refundStatus`. */
function RefundBadge({ refundStatus }: { refundStatus: BookingRow['refundStatus'] }) {
  if (refundStatus === RESELLER_BOOKING_REFUND_STATUS.REFUNDED)
    return <span className="badge badge-success">Refunded</span>
  if (refundStatus === RESELLER_BOOKING_REFUND_STATUS.PENDING)
    return <span className="badge badge-warning">Refund Pending</span>
  return null
}

interface ResellerBookingListProps {
  data: BookingRow[] | undefined
  pagination?: { page: number; limit: number; total: number }
  isLoading: boolean
  error: Error | null
  onRetry?: () => void
  page: number
  onPageChange: (page: number) => void
}

export function ResellerBookingList({ data, pagination, isLoading, error, onRetry, page, onPageChange }: ResellerBookingListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14" />)}
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load bookings" message={error?.message} onRetry={onRetry} />
  }

  if (!data?.length) {
    return <EmptyState message="No bookings via this link yet." />
  }

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1

  return (
    <div className="space-y-4">
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((b) => (
          <div key={b.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sm text-neutral-800">{b.user.name}</p>
                <p className="mt-0.5 font-mono text-xs text-neutral-400">{b.bookingRef}</p>
              </div>
              <span className="shrink-0 font-bold text-sm text-accent-600">{formatCurrency(b.totalAmount)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className="badge badge-neutral">{b.bookingStatus}</span>
                <RefundBadge refundStatus={b.refundStatus} />
              </span>
              <span>Total markup: {formatCurrency(b.markupAmount)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden max-h-[70vh] overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Booking</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Traveler</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Travelers</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Total</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Total Markup</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((b) => (
              <tr key={b.id} className="hover:bg-neutral-50">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-500">{b.bookingRef}</td>
                <td className="px-4 py-3 text-neutral-700">{b.user.name}</td>
                <td className="px-4 py-3 text-neutral-700">{b.numTravelers}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-accent-600">{formatCurrency(b.totalAmount)}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-success-600">{formatCurrency(b.markupAmount)}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <span className="badge badge-neutral">{b.bookingStatus}</span>
                    <RefundBadge refundStatus={b.refundStatus} />
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-500">
                  {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="border-t border-neutral-100 pt-4">
          <Pagination currentPage={page} totalPages={totalPages} total={pagination.total} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  )
}
