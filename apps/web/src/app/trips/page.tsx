'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { TripFilters } from '@/components/trips/trip-filters'
import { TripGrid } from '@/components/trips/trip-grid'
import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'
import type { TripFilters as TripFiltersType } from '@shared/types/trip.types'

function SearchContent() {
  const searchParams = useSearchParams()
  const [compareIds, setCompareIds] = useState<string[]>([])

  const filters: TripFiltersType = {
    destinationId: searchParams.get('destinationId') || undefined,
    destination: searchParams.get('destination') || undefined,
    tripType: (searchParams.get('tripType') as TripFiltersType['tripType']) || undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    sort: (searchParams.get('sort') as TripFiltersType['sort']) || 'date',
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: 12,
  }

  function handleCompare(tripId: string) {
    setCompareIds((prev) =>
      prev.includes(tripId) ? prev.filter((id) => id !== tripId) : [...prev, tripId].slice(0, 3),
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-neutral-800 mb-6">
        {filters.destination
          ? `Trips to "${filters.destination}"`
          : 'Explore All Trips'}
      </h1>

      {compareIds.length > 0 && (
        <div className="mb-4 rounded-lg bg-primary-50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-primary-700 font-medium">
            {compareIds.length} trip{compareIds.length > 1 ? 's' : ''} selected for comparison
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCompareIds([])}
              className="text-sm text-primary-600 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="lg:flex lg:gap-8">
        {/* Filters — mobile: toggle + drawer, desktop: sidebar */}
        <aside className="lg:w-64 lg:shrink-0">
          <TripFilters currentFilters={filters} />
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          <TripGrid
            filters={filters}
            onCompare={handleCompare}
            selectedTripIds={compareIds}
          />
        </div>
      </div>
    </div>
  )
}

export default function TripsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="skeleton h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
