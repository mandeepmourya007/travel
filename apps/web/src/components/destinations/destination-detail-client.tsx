'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, MapPin, Users, CalendarClock, IndianRupee } from 'lucide-react'
import { useDestinationDetail } from '@/hooks/use-destination-detail'
import { TripCard } from '@/components/trips/trip-card'
import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'
import { Pagination } from '@/components/shared/pagination'
import { formatCurrency } from '@/lib/format'
import type { DestinationDetailResponse } from '@shared/types/destination.types'

interface DestinationDetailClientProps {
  initialData: DestinationDetailResponse
  slug: string
}

export function DestinationDetailClient({ initialData, slug }: DestinationDetailClientProps) {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useDestinationDetail(slug, page, page === 1 ? initialData : undefined)

  const destination = data?.destination ?? initialData.destination
  const trips = data?.trips ?? initialData.trips
  const pagination = data?.tripsPagination ?? initialData.tripsPagination
  const stats = data?.stats ?? initialData.stats

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      {/* Back link */}
      <Link
        href="/trips"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Browse all trips
      </Link>

      {/* Hero */}
      <div className="relative mt-4 h-48 overflow-hidden rounded-xl sm:h-64 lg:h-80">
        {destination.photoUrl ? (
          <Image
            src={destination.photoUrl}
            alt={destination.name}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary-400 to-primary-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
            {destination.name}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-white/80">
            <MapPin className="h-4 w-4" />
            {destination.state}
          </p>
        </div>
      </div>

      {/* Description */}
      {destination.description && (
        <p className="mt-6 text-neutral-600 leading-relaxed max-w-3xl">
          {destination.description}
        </p>
      )}

      {/* Stats bar */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
            <IndianRupee className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Avg Price</p>
            <p className="font-display text-lg font-bold text-neutral-800">
              {stats.avgPrice > 0 ? formatCurrency(stats.avgPrice) : '—'}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50">
            <Users className="h-5 w-5 text-accent-500" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Organizers</p>
            <p className="font-display text-lg font-bold text-neutral-800">
              {stats.organizerCount}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50">
            <CalendarClock className="h-5 w-5 text-success-500" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Upcoming</p>
            <p className="font-display text-lg font-bold text-neutral-800">
              {stats.upcomingCount}
            </p>
          </div>
        </div>
      </div>

      {/* Trip grid */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-neutral-800">
          Trips to {destination.name}
        </h2>

        {isLoading && page > 1 ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-xl bg-error-50 border border-error-200 p-8 text-center">
            <p className="text-sm text-neutral-600">{error.message}</p>
            <button onClick={() => setPage(page)} className="btn-outline mt-4">
              Try Again
            </button>
          </div>
        ) : trips.length > 0 ? (
          <>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
            {pagination.totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="mt-8 rounded-xl bg-neutral-50 p-12 text-center">
            <p className="text-neutral-500">
              No trips available for {destination.name} right now.
            </p>
            <Link href="/trips" className="btn-primary mt-4 inline-block">
              Browse all trips
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
