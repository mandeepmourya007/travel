import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PaymentStatusBadge } from './payment-status-badge'
import { PaymentTypeBadge } from './payment-type-badge'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { formatCurrency } from '@/lib/format'
import { getPaymentBreakdown } from '@/lib/payment-calculator'
import type { PaymentHistoryItem } from '@shared/types/payment.types'

interface PaymentTransactionListProps {
  data: PaymentHistoryItem[] | undefined
  pagination?: { page: number; limit: number; total: number; totalPages: number }
  isLoading: boolean
  error: Error | null
  onRetry?: () => void
  showUser?: boolean
  hideAmount?: boolean
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
  hideAmount = false,
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
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((tx) => (
          <MobilePaymentCard key={tx.id} transaction={tx} showUser={showUser} hideAmount={hideAmount} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden max-h-[70vh] overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm md:block">
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
              {!hideAmount && (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Amount
                </th>
              )}
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
              <PaymentRow key={tx.id} transaction={tx} showUser={showUser} hideAmount={hideAmount} />
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

// ─── Mobile Card Component ───────────────────────────

function MobilePaymentCard({
  transaction,
  showUser,
  hideAmount,
}: {
  transaction: PaymentHistoryItem
  showUser: boolean
  hideAmount: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isRefund = transaction.type === 'REFUND'
  const amountColor = isRefund ? 'text-success-600' : 'text-accent-600'
  const amountPrefix = isRefund ? '+' : ''
  const breakdown = getPaymentBreakdown(transaction.amount, 0)
  const displayAmount = hideAmount ? breakdown.organizerEarnings : transaction.amount

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-sm text-neutral-800">
            {transaction.booking.trip.title}
          </p>
          <p className="mt-0.5 font-mono text-xs text-neutral-400">
            {transaction.booking.bookingRef}
          </p>
          {showUser && transaction.booking.user && (
            <p className="mt-1 text-xs text-neutral-500">{transaction.booking.user.name}</p>
          )}
        </div>
        <span className={`shrink-0 font-bold text-sm ${amountColor}`}>
          {amountPrefix}{formatCurrency(displayAmount)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PaymentTypeBadge type={transaction.type} isPartialRefund={transaction.isPartialRefund} />
          <PaymentStatusBadge status={transaction.status} />
        </div>
        <span className="text-xs text-neutral-400">
          {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* Breakdown section (organizer view only) */}
      {hideAmount && (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            Payment Breakdown
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-600">Trip payment</span>
                <span className="font-semibold text-success-600">{formatCurrency(breakdown.organizerEarnings)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Platform fee</span>
                <span className="font-semibold text-neutral-500">{formatCurrency(breakdown.platformCommission)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Row Component ───────────────────────────────────

function PaymentRow({
  transaction,
  showUser,
  hideAmount,
}: {
  transaction: PaymentHistoryItem
  showUser: boolean
  hideAmount: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isRefund = transaction.type === 'REFUND'
  const amountColor = isRefund ? 'text-success-600' : 'text-accent-600'
  const amountPrefix = isRefund ? '+' : ''
  const breakdown = getPaymentBreakdown(transaction.amount, 0)
  const displayAmount = hideAmount ? breakdown.organizerEarnings : transaction.amount

  return (
    <>
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
          {amountPrefix}{formatCurrency(displayAmount)}
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
        {hideAmount && (
          <td className="px-4 py-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <ChevronDown className={`h-3.5 w-3.5 inline transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </td>
        )}
      </tr>
      {hideAmount && expanded && (
        <tr className="bg-neutral-50">
          <td colSpan={showUser ? 7 : 6} className="px-4 py-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between max-w-xs">
                <span className="text-neutral-600">Trip payment</span>
                <span className="font-semibold text-success-600">{formatCurrency(breakdown.organizerEarnings)}</span>
              </div>
              <div className="flex justify-between max-w-xs">
                <span className="text-neutral-600">Platform fee</span>
                <span className="font-semibold text-neutral-500">{formatCurrency(breakdown.platformCommission)}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
