'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/shared/data-states'
import { Pagination } from '@/components/shared/pagination'
import { formatCurrency } from '@/lib/format'
import { PendingPayoutsSkeleton } from './pending-payouts-skeleton'
import type { AdminPendingPayoutItem } from '@shared/types/admin.types'
import type { PaginationMeta } from '@shared/types/api-response.types'

const UNRECONCILED_PAYOUT_WARNING =
  'Unreconciled payout — a prior payout succeeded at the gateway but was never debited from the wallet. Verify with Finance before sending another payout.'

/**
 * Two distinct reasons a "Send Payout" button can be disabled, checked in priority order:
 * - `hasUnreconciledPayout`: a prior payout already succeeded at the gateway but the wallet
 *   ledger was never debited — sending another payout risks double-paying the organizer, so
 *   this is surfaced (and blocks) even if a fund account exists.
 * - `!hasFundAccount`: the organizer has no RazorpayX fund account on file, so a payout has
 *   nowhere to be sent.
 */
function getSendPayoutDisabledReason(org: AdminPendingPayoutItem): string | undefined {
  if (org.hasUnreconciledPayout) return UNRECONCILED_PAYOUT_WARNING
  if (!org.hasFundAccount) return 'No RazorpayX fund account on file'
  return undefined
}

interface PendingPayoutsTableProps {
  data: AdminPendingPayoutItem[] | undefined
  pagination?: PaginationMeta
  isLoading: boolean
  error: Error | null
  onRetry?: () => void
  onSendPayout: (organizer: AdminPendingPayoutItem) => void
  page: number
  onPageChange: (page: number) => void
}

export function PendingPayoutsTable({
  data,
  pagination,
  isLoading,
  error,
  onRetry,
  onSendPayout,
  page,
  onPageChange,
}: PendingPayoutsTableProps) {
  if (isLoading) return <PendingPayoutsSkeleton />

  if (error) {
    return <ErrorState title="Failed to load pending payouts" message={error.message} onRetry={onRetry} />
  }

  if (!data?.length) {
    return <EmptyState message="No pending payouts — every organizer's wallet balance is at zero." />
  }

  return (
    <div className="space-y-4">
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {data.map((org) => (
          <div key={org.organizerId} className="card-static space-y-3 p-4">
            <div>
              <p className="font-semibold text-sm text-neutral-800">{org.businessName}</p>
              <p className="text-xs text-neutral-500">{org.userName}</p>
            </div>
            <p className="font-bold text-lg text-neutral-900">{formatCurrency(org.balance)}</p>
            {org.hasUnreconciledPayout && (
              <span className="badge badge-warning flex w-fit items-center gap-1" title={UNRECONCILED_PAYOUT_WARNING}>
                <AlertTriangle className="h-3 w-3" />
                Unreconciled payout — verify before sending
              </span>
            )}
            {org.balance > 0 && (
              <Button
                className="w-full"
                disabled={!org.hasFundAccount || org.hasUnreconciledPayout}
                title={getSendPayoutDisabledReason(org)}
                onClick={() => onSendPayout(org)}
              >
                Send Payout
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Organizer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Pending Balance</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((org) => (
              <tr key={org.organizerId} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-neutral-800">{org.businessName}</p>
                  <p className="text-xs text-neutral-500">{org.userName}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="font-bold text-neutral-900">{formatCurrency(org.balance)}</p>
                  {org.hasUnreconciledPayout && (
                    <span
                      className="badge badge-warning mt-1 flex w-fit items-center gap-1"
                      title={UNRECONCILED_PAYOUT_WARNING}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Unreconciled payout
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {org.balance > 0 && (
                    <Button
                      size="sm"
                      disabled={!org.hasFundAccount || org.hasUnreconciledPayout}
                      title={getSendPayoutDisabledReason(org)}
                      onClick={() => onSendPayout(org)}
                    >
                      Send Payout
                    </Button>
                  )}
                </td>
              </tr>
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
