import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { WalletTxTypeBadge } from './wallet-tx-type-badge'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CREDIT_TYPES } from '@shared/types/wallet.types'
import type { WalletTransactionItem } from '@shared/types/wallet.types'

interface WalletTransactionListProps {
  data: WalletTransactionItem[] | undefined
  pagination?: { page: number; limit: number; total: number; totalPages: number }
  isLoading: boolean
  error: Error | null
  onRetry?: () => void
  page: number
  onPageChange: (page: number) => void
}

export function WalletTransactionList({
  data,
  pagination,
  isLoading,
  error,
  onRetry,
  page,
  onPageChange,
}: WalletTransactionListProps) {
  // State 1: Loading
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  // State 2: Error
  if (error) {
    return <ErrorState title="Failed to load wallet transactions" message={error?.message} onRetry={onRetry} />
  }

  // State 3: Empty
  if (!data?.length) {
    return (
      <EmptyState message="No wallet transactions yet. Your refunds, cashback, and credits will appear here." />
    )
  }

  // State 4: Data — mobile-first card layout (tables → stacked cards on mobile)
  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Description
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Balance
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((tx) => (
              <WalletTxRow key={tx.id} transaction={tx} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-3 md:hidden">
        {data.map((tx) => (
          <WalletTxCard key={tx.id} transaction={tx} />
        ))}
      </div>

      {/* Pagination */}
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

// ─── Desktop Row ────────────────────────────────────

function WalletTxRow({ transaction }: { transaction: WalletTransactionItem }) {
  const isCredit = CREDIT_TYPES.includes(transaction.type)
  const amountColor = isCredit ? 'text-success-600' : 'text-error-600'
  const prefix = isCredit ? '+' : '-'

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-3">
        <WalletTxTypeBadge type={transaction.type} />
      </td>
      <td className="px-4 py-3 text-neutral-700">
        {transaction.description}
        {transaction.tripName && (
          <p className="mt-0.5 text-xs text-neutral-500">Trip: {transaction.tripName}</p>
        )}
      </td>
      <td className={cn('whitespace-nowrap px-4 py-3 text-right font-mono font-bold', amountColor)}>
        {prefix}{formatCurrency(transaction.amount)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-neutral-500">
        {formatCurrency(transaction.balanceAfter)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-neutral-500">
        {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </td>
    </tr>
  )
}

// ─── Mobile Card ────────────────────────────────────

function WalletTxCard({ transaction }: { transaction: WalletTransactionItem }) {
  const isCredit = CREDIT_TYPES.includes(transaction.type)
  const amountColor = isCredit ? 'text-success-600' : 'text-error-600'
  const prefix = isCredit ? '+' : '-'
  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 rounded-lg p-2', isCredit ? 'bg-success-50' : 'bg-error-50')}>
          <Icon className={cn('h-4 w-4', isCredit ? 'text-success-600' : 'text-error-600')} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <WalletTxTypeBadge type={transaction.type} />
          </div>
          <p className="mt-1 truncate text-sm text-neutral-600">{transaction.description}</p>
          {transaction.tripName && (
            <p className="mt-0.5 truncate text-xs text-neutral-500">Trip: {transaction.tripName}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('whitespace-nowrap font-mono text-sm font-bold', amountColor)}>
            {prefix}{formatCurrency(transaction.amount)}
          </p>
          <p className="mt-0.5 whitespace-nowrap font-mono text-xs text-neutral-400">
            Bal: {formatCurrency(transaction.balanceAfter)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-right text-xs text-neutral-400">
        {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
    </div>
  )
}
