import { PaymentStatusBadge } from './payment-status-badge'
import { PaymentTypeBadge } from './payment-type-badge'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { formatCurrency } from '@/lib/format'
import type { PaymentHistoryItem } from '@shared/types/payment.types'

interface PaymentTransactionListProps {
  data: PaymentHistoryItem[] | undefined
  pagination?: { page: number; limit: number; total: number; totalPages: number }
  isLoading: boolean
  error: Error | null
  onRetry?: () => void
  showUser?: boolean
  page: number
  onPageChange: (page: number) => void
}

export function PaymentTransactionList({
  data,
  pagination,
  isLoading,
  error,
  onRetry,
  showUser = false,
  page,
  onPageChange,
}: PaymentTransactionListProps) {
  // State 1: Loading
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-14" />
        ))}
      </div>
    )
  }

  // State 2: Error
  if (error) {
    return <ErrorState title="Failed to load payments" message={error?.message} onRetry={onRetry} />
  }

  // State 3: Empty
  if (!data?.length) {
    return <EmptyState message="No payment transactions found." />
  }

  // State 4: Data
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Booking
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Trip
              </th>
              {showUser && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Traveler
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((tx) => (
              <PaymentRow key={tx.id} transaction={tx} showUser={showUser} />
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="border-t border-neutral-100 pt-4">
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  )
}

// ─── Row Component ───────────────────────────────────

function PaymentRow({
  transaction,
  showUser,
}: {
  transaction: PaymentHistoryItem
  showUser: boolean
}) {
  const isRefund = transaction.type === 'REFUND'
  const amountColor = isRefund ? 'text-success-600' : 'text-accent-600'
  const amountPrefix = isRefund ? '+' : ''

  return (
    <tr className="hover:bg-neutral-50">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-500">
        {transaction.booking.bookingRef}
      </td>
      <td className="px-4 py-3 font-semibold text-neutral-800">
        {transaction.booking.trip.title}
      </td>
      {showUser && (
        <td className="px-4 py-3 text-neutral-700">
          {transaction.booking.user?.name ?? '—'}
        </td>
      )}
      <td className="px-4 py-3">
        <PaymentTypeBadge type={transaction.type} isPartialRefund={transaction.isPartialRefund} />
      </td>
      <td className={`whitespace-nowrap px-4 py-3 font-bold ${amountColor}`}>
        {amountPrefix}{formatCurrency(transaction.amount)}
      </td>
      <td className="px-4 py-3">
        <PaymentStatusBadge status={transaction.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-500">
        {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </td>
    </tr>
  )
}
