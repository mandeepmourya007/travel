'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X, Loader2 } from 'lucide-react'
import { tripKeys } from '@/lib/query-keys'
import { NumberInput } from '@/components/shared/number-input'
import { PriceRangeSlider } from '@/components/shared/price-range-slider'
import { useDestinations } from '@/hooks/use-destinations'
import { useTripCategories } from '@/hooks/use-trip-categories'
import { useDebounce } from '@/hooks/use-debounce'
import type { TripFilters as TripFiltersType } from '@shared/types/trip.types'
const PRICE_MIN = 0
const PRICE_MAX = 90000
const PRICE_STEP = 500

function clampPrice(n: number) {
  return Math.min(Math.max(n, PRICE_MIN), PRICE_MAX)
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'date', label: 'Soonest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'popularity', label: 'Most Popular' },
] as const

interface TripFiltersProps {
  currentFilters: TripFiltersType
  onFilterChange?: () => void
}

export function TripFilters({ currentFilters, onFilterChange }: TripFiltersProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFetchingTrips = useIsFetching({ queryKey: tripKeys.lists() }) > 0
  const [localPending, setLocalPending] = useState(false)
  const showLoader = localPending || isFetchingTrips

  const markPending = useCallback(() => {
    setLocalPending(true)
    onFilterChange?.()
  }, [onFilterChange])
  const { data: destinations } = useDestinations()
  const { data: tripCategories } = useTripCategories()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState(currentFilters.q || '')
  const [localMinPrice, setLocalMinPrice] = useState(currentFilters.minPrice?.toString() || '')
  const [localMaxPrice, setLocalMaxPrice] = useState(currentFilters.maxPrice?.toString() || '')
  const debouncedSearch = useDebounce(localSearch, 400)
  const debouncedMin = useDebounce(localMinPrice, 500)
  const debouncedMax = useDebounce(localMaxPrice, 500)

  // Derive the slider [low, high] from the string inputs; clamp to [PRICE_MIN, PRICE_MAX].
  const sliderValue: [number, number] = [
    clampPrice(localMinPrice ? Number(localMinPrice) : PRICE_MIN),
    clampPrice(localMaxPrice ? Number(localMaxPrice) : PRICE_MAX),
  ]

  // Slider → inputs: treat the bounds as "no filter" (empty string) so the URL stays clean.
  const handleSliderChange = useCallback(([lo, hi]: [number, number]) => {
    setLocalMinPrice(lo <= PRICE_MIN ? '' : String(lo))
    setLocalMaxPrice(hi >= PRICE_MAX ? '' : String(hi))
  }, [])

  const isInitialMount = useRef(true)
  const isSearchInitialMount = useRef(true)
  const searchParamsRef = useRef(searchParams)
  searchParamsRef.current = searchParams

  // Clear localPending once the fetch completes
  useEffect(() => {
    if (!isFetchingTrips) setLocalPending(false)
  }, [isFetchingTrips])

  const updateFilters = useCallback(
    (key: string, value: string | undefined) => {
      markPending()
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    if (isSearchInitialMount.current) {
      isSearchInitialMount.current = false
      return
    }
    markPending()
    const params = new URLSearchParams(searchParamsRef.current.toString())
    debouncedSearch.trim() ? params.set('q', debouncedSearch.trim()) : params.delete('q')
    params.delete('page')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [debouncedSearch, pathname, router])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    markPending()
    const params = new URLSearchParams(searchParamsRef.current.toString())
    debouncedMin ? params.set('minPrice', debouncedMin) : params.delete('minPrice')
    debouncedMax ? params.set('maxPrice', debouncedMax) : params.delete('maxPrice')
    params.delete('page')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [debouncedMin, debouncedMax, pathname, router])

  const clearFilters = useCallback(() => {
    markPending()
    setLocalSearch('')
    setLocalMinPrice('')
    setLocalMaxPrice('')
    router.push(pathname, { scroll: false })
  }, [pathname, router])

  const hasActiveFilters =
    currentFilters.q ||
    currentFilters.destinationId ||
    currentFilters.tripType ||
    currentFilters.minPrice ||
    currentFilters.maxPrice

  const filterContent = (
    <div className="space-y-5">
      {/* Free-text search */}
      <div>
        <label htmlFor="filter-search" className="block text-sm font-semibold text-neutral-700 mb-2">
          Search
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            id="filter-search"
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Trip name, destination…"
            className="input pl-9 pr-8 text-sm"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

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
          {tripCategories?.map((cat) => (
            <button
              key={cat.value}
              onClick={() =>
                updateFilters('tripType', currentFilters.tripType === cat.value ? undefined : cat.value)
              }
              className={
                currentFilters.tripType === cat.value
                  ? 'badge bg-primary-500 text-white'
                  : 'badge bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Price Range
        </label>
        <PriceRangeSlider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={sliderValue}
          onValueChange={handleSliderChange}
          className="mb-3"
        />
        <div className="flex gap-2 items-center">
          <NumberInput
            id="filter-min-price"
            placeholder="Min"
            value={localMinPrice}
            onChange={setLocalMinPrice}
            min={0}
            className="w-24"
            inputClassName="text-sm"
          />
          <span className="text-neutral-400">–</span>
          <NumberInput
            id="filter-max-price"
            placeholder="Max"
            value={localMaxPrice}
            onChange={setLocalMaxPrice}
            min={0}
            className="w-24"
            inputClassName="text-sm"
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Sort By
        </label>
        <select
          value={currentFilters.sort || 'newest'}
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
        aria-label="Open filters"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {showLoader ? (
          <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-primary-500" />
        ) : hasActiveFilters ? (
          <span className="ml-1 h-2 w-2 rounded-full bg-primary-500" />
        ) : null}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative ml-auto w-4/5 max-w-80 bg-white p-6 shadow-lg overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg font-bold text-neutral-800 flex items-center gap-2">
                Filters
                {showLoader && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
              </h3>
              <button onClick={() => setMobileOpen(false)} aria-label="Close filters">
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            {filterContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-display text-base font-bold text-neutral-800">Filters</h3>
          {showLoader && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
        </div>
        {filterContent}
      </div>
    </>
  )
}
