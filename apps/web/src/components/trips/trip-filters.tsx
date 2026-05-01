'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useCallback } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { useDestinations } from '@/hooks/use-destinations'
import { tripTypeLabel } from '@/lib/format'
import type { TripFilters as TripFiltersType } from '@shared/types/trip.types'

const TRIP_TYPES = ['ADVENTURE', 'WEEKEND', 'TREKKING', 'BEACH', 'CULTURAL', 'ROAD_TRIP'] as const
const SORT_OPTIONS = [
  { value: 'date', label: 'Soonest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'popularity', label: 'Most Popular' },
] as const

interface TripFiltersProps {
  currentFilters: TripFiltersType
}

export function TripFilters({ currentFilters }: TripFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: destinations } = useDestinations()
  const [mobileOpen, setMobileOpen] = useState(false)

  const updateFilters = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const clearFilters = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  const hasActiveFilters =
    currentFilters.destinationId ||
    currentFilters.tripType ||
    currentFilters.minPrice ||
    currentFilters.maxPrice

  const filterContent = (
    <div className="space-y-5">
      {/* Destination */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Destination
        </label>
        <select
          value={currentFilters.destinationId || ''}
          onChange={(e) => updateFilters('destinationId', e.target.value || undefined)}
          className="input text-sm"
        >
          <option value="">All Destinations</option>
          {destinations?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Trip Type */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Trip Type
        </label>
        <div className="flex flex-wrap gap-2">
          {TRIP_TYPES.map((type) => (
            <button
              key={type}
              onClick={() =>
                updateFilters('tripType', currentFilters.tripType === type ? undefined : type)
              }
              className={
                currentFilters.tripType === type
                  ? 'badge bg-primary-500 text-white'
                  : 'badge bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }
            >
              {tripTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Price Range
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            value={currentFilters.minPrice || ''}
            onChange={(e) => updateFilters('minPrice', e.target.value || undefined)}
            className="input text-sm w-24"
            min={0}
          />
          <span className="text-neutral-400">–</span>
          <input
            type="number"
            placeholder="Max"
            value={currentFilters.maxPrice || ''}
            onChange={(e) => updateFilters('maxPrice', e.target.value || undefined)}
            className="input text-sm w-24"
            min={0}
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Sort By
        </label>
        <select
          value={currentFilters.sort || 'date'}
          onChange={(e) => updateFilters('sort', e.target.value)}
          className="input text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button onClick={clearFilters} className="btn-ghost text-sm text-accent-600 w-full">
          Clear All Filters
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden flex items-center gap-2 btn-secondary text-sm mb-4"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {hasActiveFilters && (
          <span className="ml-1 h-2 w-2 rounded-full bg-primary-500" />
        )}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative ml-auto w-80 bg-white p-6 shadow-lg overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg font-bold text-neutral-800">Filters</h3>
              <button onClick={() => setMobileOpen(false)} aria-label="Close filters">
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            {filterContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">{filterContent}</div>
    </>
  )
}
