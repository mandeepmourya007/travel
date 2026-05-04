'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTrendingTrips } from '@/hooks/use-trips'
import { TripCard } from '@/components/trips/trip-card'
import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'
import { useCompareQueue } from '@/hooks/use-compare-queue'

export function TrendingTrips() {
  const { data, isLoading, error } = useTrendingTrips()
  const { selectedIds, toggle } = useCompareQueue()

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl font-bold text-neutral-800">
            Trending Trips This Weekend
          </h2>
          <Link
            href="/trips"
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <p className="text-center text-neutral-400 py-12">
            Could not load trending trips. Please try again later.
          </p>
        ) : data?.trips.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.trips.slice(0, 6).map((trip) => (
              <TripCard key={trip.id} trip={trip} onCompare={toggle} isSelected={selectedIds.includes(trip.id)} />
            ))}
          </div>
        ) : (
          <p className="text-center text-neutral-400 py-12">
            No trips available right now. Check back soon!
          </p>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link href="/trips" className="btn-secondary inline-flex items-center gap-2">
            View All Trips
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
