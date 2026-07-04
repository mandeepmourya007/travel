'use client'

import { useState } from 'react'
import { AuthGuard } from '@/components/shared/auth-guard'
import { useMyPayments, useMyPaymentSummary } from '@/hooks/use-payments'
import { TravelerPaymentSummaryCards, PaymentSummaryCardsSkeleton } from '@/components/payments/payment-summary-cards'
import { PaymentFilters } from '@/components/payments/payment-filters'
import { PaymentTransactionList } from '@/components/payments/payment-transaction-list'
import { TravelerTripSearchCombobox } from '@/components/shared/trip-search-combobox'
import { ErrorState } from '@/components/shared/data-states'
import { TRAVELER_ROLES } from '@shared/constants/roles'
import type { PaymentHistoryFilters } from '@shared/types/payment.types'

export default function MyPaymentsPage() {
  const [filters, setFilters] = useState<PaymentHistoryFilters>({})
  const [tripId, setTripId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  const summary = useMyPaymentSummary()
  const payments = useMyPayments({ ...filters, tripId, page })

  return (
    <AuthGuard allowedRoles={[...TRAVELER_ROLES]}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8 space-y-6">
        <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">My Payments</h1>

        {/* Summary cards */}
        {summary.isLoading ? (
          <PaymentSummaryCardsSkeleton />
        ) : summary.error ? (
          <ErrorState title="Failed to load payment summary" message={summary.error?.message} onRetry={() => summary.refetch()} />
        ) : summary.data ? (
          <TravelerPaymentSummaryCards {...summary.data} />
        ) : null}

        {/* Trip picker + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-[200px] sm:w-64 flex-shrink-0">
            <TravelerTripSearchCombobox
              value={tripId}
              onChange={(id) => { setTripId(id); setPage(1) }}
            />
          </div>
          <div className="flex-1">
            <PaymentFilters
              activeType={filters.type}
              activeStatus={filters.status}
              fromDate={filters.fromDate}
              toDate={filters.toDate}
              onTypeChange={(type) => { setFilters((prev) => ({ ...prev, type })); setPage(1) }}
              onStatusChange={(status) => { setFilters((prev) => ({ ...prev, status })); setPage(1) }}
              onFromDateChange={(fromDate) => { setFilters((prev) => ({ ...prev, fromDate })); setPage(1) }}
              onToDateChange={(toDate) => { setFilters((prev) => ({ ...prev, toDate })); setPage(1) }}
            />
          </div>
        </div>

        {/* Transaction list — 4-state rendering */}
        <PaymentTransactionList
          data={payments.data?.data}
          pagination={payments.data?.pagination}
          isLoading={payments.isLoading}
          error={payments.error}
          onRetry={() => payments.refetch()}
          page={page}
          onPageChange={setPage}
        />
      </div>
    </AuthGuard>
  )
}
