'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, MapPin, Users, CalendarClock, IndianRupee,
  TrendingDown, SlidersHorizontal, X,
} from 'lucide-react'
import { useDestinationDetail } from '@/hooks/use-destination-detail'
import { DestinationCard } from '@/components/destinations/destination-card'
import { TripCard } from '@/components/trips/trip-card'
import { TripCardSkeleton } from '@/components/trips/trip-card-skeleton'
import { NumberInput } from '@/components/shared/number-input'
import { Pagination } from '@/components/shared/pagination'
import { formatCurrency, tripTypeLabel } from '@/lib/format'
import { useTripCategories } from '@/hooks/use-trip-categories'
import { cn } from '@/lib/utils'
import type { DestinationDetailResponse, DestinationTripFilters, DestinationTripSort } from '@shared/types/destination.types'
const SORT_OPTIONS: { value: DestinationTripSort; label: string }[] = [
  { value: 'date', label: 'Soonest' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
]

interface DestinationDetailClientProps {
  initialData: DestinationDetailResponse
  slug: string
}

export function DestinationDetailClient({ initialData, slug }: DestinationDetailClientProps) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<DestinationTripFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [minPriceStr, setMinPriceStr] = useState('')
  const [maxPriceStr, setMaxPriceStr] = useState('')
  const { data: tripCategories } = useTripCategories()

  const hasFilters = !!(filters.tripType || filters.sort || filters.minPrice || filters.maxPrice)
  const isInitial = page === 1 && !hasFilters

  const { data, isLoading, error, refetch } = useDestinationDetail(
    slug,
    page,
    isInitial ? initialData : undefined,
    hasFilters ? filters : undefined,
  )

  const destination = data?.destination ?? initialData.destination
  const trips = data?.trips ?? initialData.trips
  const pagination = data?.tripsPagination ?? initialData.tripsPagination
  const stats = data?.stats ?? initialData.stats
  const relatedDestinations = data?.relatedDestinations ?? initialData.relatedDestinations

  const updateFilter = useCallback((patch: Partial<DestinationTripFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
    setMinPriceStr('')
    setMaxPriceStr('')
    setPage(1)
  }, [])

  const applyPriceRange = useCallback(() => {
    const min = minPriceStr ? Number(minPriceStr) : undefined
    const max = maxPriceStr ? Number(maxPriceStr) : undefined
    updateFilter({ minPrice: min, maxPrice: max })
  }, [minPriceStr, maxPriceStr, updateFilter])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/destinations" className="btn-ghost p-1.5 -ml-1.5">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Link href="/" className="hover:text-primary-600 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/destinations" className="hover:text-primary-600 transition-colors">Destinations</Link>
        <span>/</span>
        <span className="text-neutral-800 font-medium">{destination.name}</span>
      </nav>

      {/* Hero */}
      <div className="relative mt-4 h-52 overflow-hidden rounded-xl sm:h-64 lg:h-80">
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
          {stats.minPrice > 0 && (
            <p className="mt-2 text-sm text-white/90 font-mono">
              From {formatCurrency(stats.minPrice)}/person
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      {destination.description && (
        <p className="mt-6 text-neutral-600 leading-relaxed max-w-3xl">
          {destination.description}
        </p>
      )}

      {/* Stats bar */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<IndianRupee className="h-5 w-5 text-primary-600" />}
          label="Price Range"
          value={stats.minPrice > 0
            ? `${formatCurrency(stats.minPrice)} – ${formatCurrency(stats.maxPrice)}`
            : '—'}
          bgClass="bg-primary-50"
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5 text-highlight-600" />}
          label="Avg Price"
          value={stats.avgPrice > 0 ? formatCurrency(stats.avgPrice) : '—'}
          bgClass="bg-highlight-50"
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-accent-600" />}
          label="Organizers"
          value={String(stats.organizerCount)}
          bgClass="bg-accent-50"
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5 text-success-600" />}
          label="Upcoming"
          value={String(stats.upcomingCount)}
          bgClass="bg-success-50"
        />
      </div>

      {/* Trip section */}
      <section className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-bold text-neutral-800">
            Trips to {destination.name}
            {pagination.total > 0 && (
              <span className="ml-2 text-sm font-normal text-neutral-500">
                ({pagination.total})
              </span>
            )}
          </h2>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
              showFilters ? 'text-primary-600' : 'text-neutral-600 hover:text-primary-600',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasFilters && (
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] text-white">
                !
              </span>
            )}
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-4">
            {/* Trip type pills */}
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">Trip Type</p>
              <div className="flex flex-wrap gap-2">
                {tripCategories?.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => updateFilter({ tripType: filters.tripType === cat.value ? undefined : cat.value })}
                    className={cn(
                      'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                      filters.tripType === cat.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-neutral-600 border border-neutral-200 hover:border-primary-300',
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">Sort By</p>
              <div className="flex gap-2">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter({ sort: filters.sort === opt.value ? undefined : opt.value })}
                    className={cn(
                      'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                      filters.sort === opt.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-neutral-600 border border-neutral-200 hover:border-primary-300',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">Price Range</p>
              <div className="flex items-end gap-2">
                <NumberInput
                  value={minPriceStr}
                  onChange={setMinPriceStr}
                  placeholder="Min"
                  prefix="₹"
                  min={0}
                  className="flex-1"
                  inputClassName="h-9 text-sm"
                />
                <span className="pb-2 text-neutral-400">–</span>
                <NumberInput
                  value={maxPriceStr}
                  onChange={setMaxPriceStr}
                  placeholder="Max"
                  prefix="₹"
                  min={0}
                  className="flex-1"
                  inputClassName="h-9 text-sm"
                />
                <button onClick={applyPriceRange} className="btn-primary h-9 px-4 text-sm">
                  Go
                </button>
              </div>
            </div>

            {/* Clear */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-sm text-error-600 hover:text-error-700"
              >
                <X className="h-3.5 w-3.5" />
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Active filter badges (visible even when panel closed) */}
        {hasFilters && !showFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {filters.tripType && (
              <FilterBadge
                label={tripTypeLabel(filters.tripType)}
                onRemove={() => updateFilter({ tripType: undefined })}
              />
            )}
            {filters.sort && (
              <FilterBadge
                label={SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort}
                onRemove={() => updateFilter({ sort: undefined })}
              />
            )}
            {(filters.minPrice || filters.maxPrice) && (
              <FilterBadge
                label={`${filters.minPrice ? formatCurrency(filters.minPrice) : '₹0'} – ${filters.maxPrice ? formatCurrency(filters.maxPrice) : '∞'}`}
                onRemove={() => {
                  setMinPriceStr('')
                  setMaxPriceStr('')
                  updateFilter({ minPrice: undefined, maxPrice: undefined })
                }}
              />
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-error-600 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Trip grid */}
        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TripCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-xl bg-error-50 border border-error-200 p-8 text-center">
            <p className="text-sm text-neutral-600">{error.message}</p>
            <button onClick={() => refetch()} className="btn-outline mt-4">
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
              {hasFilters
                ? 'No trips match your filters.'
                : `No trips available for ${destination.name} right now.`}
            </p>
            {hasFilters ? (
              <button onClick={clearFilters} className="btn-outline mt-4">
                Clear filters
              </button>
            ) : (
              <Link href="/trips" className="btn-primary mt-4 inline-block">
                Browse all trips
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Related destinations */}
      {relatedDestinations.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-bold text-neutral-800">
            Related Destinations
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedDestinations.map((dest) => (
              <DestinationCard key={dest.id} destination={dest} />
            ))}
          </div>
          <div className="mt-4 text-center">
            <Link
              href="/destinations"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              View all destinations →
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, bgClass }: {
  icon: React.ReactNode
  label: string
  value: string
  bgClass: string
}) {
  return (
    <div className="card flex items-center gap-3 p-3 sm:p-4">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', bgClass)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="font-display text-sm font-bold text-neutral-800 sm:text-base truncate">
          {value}
        </p>
      </div>
    </div>
  )
}

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
      {label}
      <button onClick={onRemove} className="hover:text-primary-900">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
