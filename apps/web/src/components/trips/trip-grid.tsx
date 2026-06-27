'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTrips } from '@/hooks/use-trips'
import { TripCard } from './trip-card'
import { TripCardSkeleton } from './trip-card-skeleton'
import { Pagination } from '@/components/shared/pagination'
import { ErrorState, EmptyState } from '@/components/shared/data-states'
import type { TripFilters, TripSummary } from '@shared/types/trip.types'

interface TripGridProps {
  filters: TripFilters
  onCompare: (trip: TripSummary) => void
  selectedTripIds?: string[]
  initialData?: { trips: TripSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } | null }
  isFiltering?: boolean
  onFetchComplete?: () => void
}

export function TripGrid({ filters, onCompare, selectedTripIds = [], initialData, isFiltering = false, onFetchComplete }: TripGridProps) {
  const searchParams = useSearchParams()
  const { data, isLoading, isFetching, error, refetch } = useTrips(filters, { initialData })

  useEffect(() => {
    if (!isFetching) onFetchComplete?.()
  }, [isFetching, onFetchComplete])

  if (isLoading || isFetching || isFiltering) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <TripCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Failed to load trips" message={error.message} onRetry={refetch} />
  }

  if (!data?.trips.length) {
    return <EmptyState message="No trips found matching your search. Try adjusting filters." />
  }

  function buildPageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    return `?${params.toString()}`
  }

  return (
    <div>
      <p className="text-sm text-neutral-500 mb-4">
          {data.pagination?.total ?? data.trips.length} trips found
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.trips.map((trip, i) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onCompare={onCompare}
              isSelected={selectedTripIds.includes(trip.id)}
              priority={i < 3}
            />
          ))}
        </div>

        {/* Pagination */}
        {data.pagination && data.pagination.totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              buildHref={buildPageHref}
            />
          </div>
        )}
    </div>
  )
}
