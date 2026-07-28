'use client'

import { Fragment } from 'react'
import { WalletTxTypeBadge } from '@/components/wallet/wallet-tx-type-badge'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState, ErrorState } from '@/components/shared/data-states'
import { formatCurrency, formatDateFull } from '@/lib/format'
import { CREDIT_TYPES } from '@shared/types/wallet.types'
import type { WalletTransactionType } from '@shared/types/wallet.types'
import type { AdminPayoutHistoryItem } from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

interface PayoutActivityTableProps {
  data: AdminPayoutHistoryItem[] | undefined
  pagination?: PaginationMeta
  isLoading: boolean
  error: Error | null
  onRetry?: () => void
  page: number
  onPageChange: (page: number) => void
}

function AmountCell({ item }: { item: AdminPayoutHistoryItem }) {
  // Credits add to the organizer's balance, debits remove from it — sign the amount
  // accordingly for the "+/-" display, reusing the shared CREDIT_TYPES lookup rather
  // than redeclaring which of the four organizer-ledger types adds vs. subtracts.
  const isCredit = CREDIT_TYPES.includes(item.type as WalletTransactionType)
  return (
    <span className={isCredit ? 'font-bold text-success-600' : 'font-bold text-error-600'}>
      {isCredit ? '+' : '-'}{formatCurrency(item.amount)}
    </span>
  )
}

export function PayoutActivityTable({
  data,
  pagination,
  isLoading,
  error,
  onRetry,
  page,
  onPageChange,
}: PayoutActivityTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-14" />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load wallet activity" message={error.message} onRetry={onRetry} />
  }

  if (!data?.length) {
    return <EmptyState message="No organizer wallet activity yet." />
  }

  return (
    <div className="space-y-4">
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((item) => (
          <div key={item.id} className="card-static space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-sm text-neutral-800">{item.organizerName}</p>
                <span className="text-xs text-neutral-400">{formatDateFull(item.createdAt)}</span>
              </div>
              <AmountCell item={item} />
            </div>
            <WalletTxTypeBadge type={item.type as WalletTransactionType} />
            {item.description && <p className="text-xs text-neutral-500">{item.description}</p>}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Organizer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((item) => (
              <Fragment key={item.id}>
                <tr className="hover:bg-neutral-50">
                  <td className={item.description ? 'px-4 pb-1 pt-3 font-semibold text-neutral-800' : 'px-4 py-3 font-semibold text-neutral-800'}>
                    {item.organizerName}
                  </td>
                  <td className={item.description ? 'px-4 pb-1 pt-3' : 'px-4 py-3'}>
                    <WalletTxTypeBadge type={item.type as WalletTransactionType} />
                  </td>
                  <td className={item.description ? 'whitespace-nowrap px-4 pb-1 pt-3' : 'whitespace-nowrap px-4 py-3'}>
                    <AmountCell item={item} />
                  </td>
                  <td className={item.description ? 'whitespace-nowrap px-4 pb-1 pt-3 text-neutral-500' : 'whitespace-nowrap px-4 py-3 text-neutral-500'}>
                    {formatDateFull(item.createdAt)}
                  </td>
                </tr>
                {item.description && (
                  <tr className="hover:bg-neutral-50">
                    <td colSpan={4} className="px-4 pb-3 pt-0 text-xs text-neutral-400">
                      {item.description}
                    </td>
                  </tr>
                )}
              </Fragment>
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
