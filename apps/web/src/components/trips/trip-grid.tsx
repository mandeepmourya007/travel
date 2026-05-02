'use client'

import { useSearchParams } from 'next/navigation'
import { useTrips } from '@/hooks/use-trips'
import { TripCard } from './trip-card'
import { TripCardSkeleton } from './trip-card-skeleton'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import type { TripFilters, TripSummary } from '@shared/types/trip.types'

interface TripGridProps {
  filters: TripFilters
  onCompare: (trip: TripSummary) => void
  selectedTripIds?: string[]
}

export function TripGrid({ filters, onCompare, selectedTripIds = [] }: TripGridProps) {
  const { data, isLoading, error, refetch } = useTrips(filters)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <TripCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load trips" onRetry={refetch} />
  }

  if (!data?.trips.length) {
    return <EmptyState message="No trips found matching your search. Try adjusting filters." />
  }

  return (
    <div>
      <p className="text-sm text-neutral-500 mb-4">
        {data.pagination?.total ?? data.trips.length} trips found
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.trips.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            onCompare={onCompare}
            isSelected={selectedTripIds.includes(trip.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {data.pagination && data.pagination.totalPages > 1 && (
        <Pagination
          current={data.pagination.page}
          total={data.pagination.totalPages}
        />
      )}
    </div>
  )
}

function Pagination({ current, total }: { current: number; total: number }) {
  const searchParams = useSearchParams()

  function buildPageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    return `?${params.toString()}`
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((page) => (
        <a
          key={page}
          href={buildPageHref(page)}
          className={
            page === current
              ? 'h-9 w-9 rounded-lg bg-primary-500 text-white flex items-center justify-center text-sm font-semibold'
              : 'h-9 w-9 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center text-sm font-medium hover:bg-neutral-200 transition-colors'
          }
        >
          {page}
        </a>
      ))}
    </div>
  )
}
