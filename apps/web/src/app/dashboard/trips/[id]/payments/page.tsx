'use client'

import { useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTripPayments, useTripPaymentSummary } from '@/hooks/use-payments'
import { TripPaymentSummaryCards, StatItemSkeleton } from '@/components/payments/payment-summary-cards'
import { PaymentFilters } from '@/components/payments/payment-filters'
import { PaymentTransactionList } from '@/components/payments/payment-transaction-list'
import { ErrorState } from '@/components/shared/data-states'
import type { PaymentHistoryFilters } from '@shared/types/payment.types'

export default function TripPaymentsPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const tripId = params.id
  const tripName = searchParams.get('name')

  const [filters, setFilters] = useState<PaymentHistoryFilters>({})
  const [page, setPage] = useState(1)

  const summary = useTripPaymentSummary(tripId)
  const payments = useTripPayments(tripId, { ...filters, page })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/trips" className="btn-ghost p-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-bold text-neutral-900">
            Payments{tripName ? ` — ${tripName}` : ''}
          </h2>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">Trip ID: {tripId}</p>
        </div>
      </div>

      {/* Summary cards */}
      {summary.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <StatItemSkeleton key={i} />)}
        </div>
      ) : summary.error ? (
        <ErrorState message="Failed to load payment summary" onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <TripPaymentSummaryCards {...summary.data} />
      ) : null}

      {/* Filters — values sourced from shared Zod schema */}
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

      {/* Transaction list — organizer view shows traveler column */}
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
