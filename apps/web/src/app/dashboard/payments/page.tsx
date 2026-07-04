'use client'

import { useState } from 'react'
import { useOrganizerPayments, useOrganizerPaymentSummary } from '@/hooks/use-payments'
import { TripSearchCombobox } from '@/components/shared/trip-search-combobox'
import { TripPaymentSummaryCards, PaymentSummaryCardsSkeleton } from '@/components/payments/payment-summary-cards'
import { PaymentFilters } from '@/components/payments/payment-filters'
import { PaymentTransactionList } from '@/components/payments/payment-transaction-list'
import { ErrorState } from '@/components/shared/data-states'
import { cn } from '@/lib/utils'
import type { OrganizerPaymentFilters } from '@shared/types/payment.types'
import { SORT_ORDER, type SortOrder } from '@shared/constants/sort'
import { ArrowUp, ArrowDown } from 'lucide-react'

type SortField = NonNullable<OrganizerPaymentFilters['sortBy']>

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'amount', label: 'Amount' },
  { field: 'status', label: 'Status' },
  { field: 'createdAt', label: 'Date' },
]

export default function OrganizerPaymentsPage() {
  const [baseFilters, setBaseFilters] = useState<Pick<OrganizerPaymentFilters, 'type' | 'status' | 'fromDate' | 'toDate'>>({})
  const [tripId, setTripId] = useState<string | undefined>(undefined)
  const [sortBy, setSortBy] = useState<SortField | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<SortOrder>(SORT_ORDER.DESC)
  const [page, setPage] = useState(1)

  const filters: OrganizerPaymentFilters = {
    ...baseFilters,
    tripId,
    sortBy,
    sortOrder: sortBy ? sortOrder : undefined,
    page,
  }

  const summary = useOrganizerPaymentSummary()
  const payments = useOrganizerPayments(filters)

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === SORT_ORDER.ASC ? SORT_ORDER.DESC : SORT_ORDER.ASC))
    } else {
      setSortBy(field)
      setSortOrder(SORT_ORDER.DESC)
    }
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-neutral-900">Payments</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Revenue and refunds across all your trips.
        </p>
      </div>

      {/* Summary cards */}
      {summary.isLoading ? (
        <PaymentSummaryCardsSkeleton />
      ) : summary.error ? (
        <ErrorState message="Failed to load payment summary" onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <TripPaymentSummaryCards {...summary.data} />
      ) : null}

      {/* Trip selector + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {/* Trip scope selector — searchable combobox with server-side search + pagination */}
        <div className="min-w-[200px] flex-1 sm:flex-none sm:w-72">
          <TripSearchCombobox
            value={tripId}
            onChange={(id) => { setTripId(id); setPage(1) }}
          />
        </div>

        {/* Type / status / date filters */}
        <div className="flex-1">
          <PaymentFilters
            activeType={baseFilters.type}
            activeStatus={baseFilters.status}
            fromDate={baseFilters.fromDate}
            toDate={baseFilters.toDate}
            onTypeChange={(type) => { setBaseFilters((prev) => ({ ...prev, type })); setPage(1) }}
            onStatusChange={(status) => { setBaseFilters((prev) => ({ ...prev, status })); setPage(1) }}
            onFromDateChange={(fromDate) => { setBaseFilters((prev) => ({ ...prev, fromDate })); setPage(1) }}
            onToDateChange={(toDate) => { setBaseFilters((prev) => ({ ...prev, toDate })); setPage(1) }}
          />
        </div>
      </div>

      {/* Sort chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs text-neutral-500">Sort:</span>
        {SORT_OPTIONS.map(({ field, label }) => {
          const active = sortBy === field
          return (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
              )}
            >
              {label}
              {active && (sortOrder === SORT_ORDER.ASC ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </button>
          )
        })}
      </div>

      {/* Transaction list */}
      <PaymentTransactionList
        data={payments.data?.data}
        pagination={payments.data?.pagination}
        isLoading={payments.isLoading}
        error={payments.error}
        onRetry={() => payments.refetch()}
        showUser
        page={page}
        onPageChange={setPage}
      />
    </div>
  )
}
