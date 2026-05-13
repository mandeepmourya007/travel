'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { TripFilters } from '@/components/trips/trip-filters'
import { TripGrid } from '@/components/trips/trip-grid'
import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'
import { useCompareQueue } from '@/hooks/use-compare-queue'
import type { TripFilters as TripFiltersType } from '@shared/types/trip.types'

function SearchContent() {
  const searchParams = useSearchParams()
  const { selectedIds, toggle } = useCompareQueue()

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

  return (
    <div className="lg:flex lg:gap-8">
      {/* Filters — mobile: toggle + drawer, desktop: sidebar */}
      <aside className="lg:w-64 lg:shrink-0">
        <TripFilters currentFilters={filters} />
      </aside>

      {/* Grid */}
      <div className="flex-1 min-w-0">
        <TripGrid
          filters={filters}
          onCompare={toggle}
          selectedTripIds={selectedIds}
        />
      </div>
    </div>
  )
}

export function TripsPageClient() {
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)

  useEffect(() => {
    if (hasHydrated && role === 'ORGANIZER') {
      router.replace('/dashboard')
    }
  }, [hasHydrated, role, router])

  if (hasHydrated && role === 'ORGANIZER') return null

  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <TripCardSkeleton key={i} />
          ))}
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
