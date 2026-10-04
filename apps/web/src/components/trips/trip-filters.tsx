'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X, Loader2 } from 'lucide-react'
import { tripKeys } from '@/lib/query-keys'
import { NumberInput } from '@/components/shared/number-input'
import { PriceRangeSlider } from '@/components/shared/price-range-slider'
import { useDestinations } from '@/hooks/use-destinations'
import { useTripCategories } from '@/hooks/use-trip-categories'
import { useSearchStore } from '@/store/search.store'
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

const DEFAULT_SORT: SortValue = 'newest'

/** URL search-param keys owned by the filter panel. */
const FILTER_PARAM = {
  Q: 'q',
  DESTINATION_ID: 'destinationId',
  TRIP_TYPE: 'tripType',
  MIN_PRICE: 'minPrice',
  MAX_PRICE: 'maxPrice',
  SORT: 'sort',
  PAGE: 'page',
} as const

const LABEL_APPLY = 'Apply Filters'
const LABEL_CLEAR = 'Clear Filters'
const LABEL_CLEAR_SHORT = 'Clear'
const LABEL_UNAPPLIED = 'You have unapplied changes'

type SortValue = (typeof SORT_OPTIONS)[number]['value']

/** Filter-panel values that are staged locally until "Apply Filters". `q` lives in the shared search store. */
interface StagedFilters {
  destinationId: string
  tripType: string
  minPrice: string
  maxPrice: string
  sort: string
}

const EMPTY_STAGED: StagedFilters = {
  destinationId: '',
  tripType: '',
  minPrice: '',
  maxPrice: '',
  sort: DEFAULT_SORT,
}

function stagedFromFilters(f: TripFiltersType): StagedFilters {
  return {
    destinationId: f.destinationId || '',
    tripType: f.tripType || '',
    minPrice: f.minPrice?.toString() || '',
    maxPrice: f.maxPrice?.toString() || '',
    sort: f.sort || DEFAULT_SORT,
  }
}

/** Normalised identity of a full filter set — used for dirty checks and echo detection. */
function filtersKey(q: string, s: StagedFilters): string {
  return JSON.stringify([q.trim(), s.destinationId, s.tripType, s.minPrice, s.maxPrice, s.sort || DEFAULT_SORT])
}

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
  // Search text is shared with the header search bar (both show the same value)
  // and is the staged `q` — it only reaches the URL on Apply.
  const localSearch = useSearchStore((s) => s.query)
  const setLocalSearch = useSearchStore((s) => s.setQuery)
  const resetSearch = useSearchStore((s) => s.reset)
  const [staged, setStaged] = useState<StagedFilters>(() => stagedFromFilters(currentFilters))

  const setStagedField = useCallback(<K extends keyof StagedFilters>(key: K, value: StagedFilters[K]) => {
    setStaged((prev) => ({ ...prev, [key]: value }))
  }, [])

  const appliedStaged = useMemo(
    () => stagedFromFilters(currentFilters),
    [
      currentFilters.destinationId,
      currentFilters.tripType,
      currentFilters.minPrice,
      currentFilters.maxPrice,
      currentFilters.sort,
    ],
  )
  const appliedQ = currentFilters.q || ''
  const appliedKey = filtersKey(appliedQ, appliedStaged)
  const isDirty = filtersKey(localSearch, staged) !== appliedKey

  // Derive the slider [low, high] from the string inputs; clamp to [PRICE_MIN, PRICE_MAX].
  const sliderValue: [number, number] = [
    clampPrice(staged.minPrice ? Number(staged.minPrice) : PRICE_MIN),
    clampPrice(staged.maxPrice ? Number(staged.maxPrice) : PRICE_MAX),
  ]

  // Slider → inputs: treat the bounds as "no filter" (empty string) so the URL stays clean.
  const handleSliderChange = useCallback(([lo, hi]: [number, number]) => {
    setStaged((prev) => ({
      ...prev,
      minPrice: lo <= PRICE_MIN ? '' : String(lo),
      maxPrice: hi >= PRICE_MAX ? '' : String(hi),
    }))
  }, [])

  // Key of the filter set we last pushed, until its URL echo arrives. The echo must
  // not re-seed staged values (the user may already be editing again, and the pushed
  // `q` is trimmed). Any other URL change is external and re-seeds everything.
  const pendingPushKeyRef = useRef<string | null>(null)
  const searchParamsRef = useRef(searchParams)
  searchParamsRef.current = searchParams
  const currentFiltersRef = useRef(currentFilters)
  currentFiltersRef.current = currentFilters

  // Clear localPending once the fetch completes
  useEffect(() => {
    if (!isFetchingTrips) setLocalPending(false)
  }, [isFetchingTrips])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // URL → staged values: on mount (fresh load) and on external URL changes
  // (header Enter, hero search, back/forward). Skips the echo of our own push.
  useEffect(() => {
    if (pendingPushKeyRef.current === appliedKey) {
      pendingPushKeyRef.current = null
      return
    }
    pendingPushKeyRef.current = null
    setStaged(stagedFromFilters(currentFiltersRef.current))
    setLocalSearch(currentFiltersRef.current.q || '')
  }, [appliedKey, setLocalSearch])

  const pushFilters = useCallback(
    (q: string, values: StagedFilters) => {
      const params = new URLSearchParams(searchParamsRef.current.toString())
      const entries: [string, string][] = [
        [FILTER_PARAM.Q, q.trim()],
        [FILTER_PARAM.DESTINATION_ID, values.destinationId],
        [FILTER_PARAM.TRIP_TYPE, values.tripType],
        [FILTER_PARAM.MIN_PRICE, values.minPrice],
        [FILTER_PARAM.MAX_PRICE, values.maxPrice],
        [FILTER_PARAM.SORT, values.sort === DEFAULT_SORT ? '' : values.sort],
      ]
      for (const [key, value] of entries) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      params.delete(FILTER_PARAM.PAGE)
      pendingPushKeyRef.current = filtersKey(q, values)
      markPending()
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [markPending, pathname, router],
  )

  const applyFilters = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      setMobileOpen(false)
      if (!isDirty) return
      pushFilters(localSearch, staged)
    },
    [isDirty, localSearch, pushFilters, staged],
  )

  const hasActiveFilters = Boolean(
    currentFilters.q ||
      currentFilters.destinationId ||
      currentFilters.tripType ||
      currentFilters.minPrice ||
      currentFilters.maxPrice ||
      (currentFilters.sort && currentFilters.sort !== DEFAULT_SORT),
  )
  const showClear = hasActiveFilters || isDirty

  // Resets staged values, the shared search text (header too) and — if anything
  // is applied — the URL, immediately.
  const clearFilters = useCallback(() => {
    setStaged(EMPTY_STAGED)
    resetSearch()
    setMobileOpen(false)
    if (!hasActiveFilters) return
    pendingPushKeyRef.current = filtersKey('', EMPTY_STAGED)
    markPending()
    router.push(pathname, { scroll: false })
  }, [hasActiveFilters, markPending, pathname, resetSearch, router])

  const filterFields = (
    <div className="space-y-5">
      {/* Free-text search — Enter submits the surrounding form (= Apply) */}
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
            placeholder="e.g. weekend amritsar, adventure trek…"
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
          aria-label="Destination"
          value={staged.destinationId}
          onChange={(e) => setStagedField('destinationId', e.target.value)}
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
              type="button"
              aria-pressed={staged.tripType === cat.value}
              onClick={() =>
                setStagedField('tripType', staged.tripType === cat.value ? '' : cat.value)
              }
              className={
                staged.tripType === cat.value
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
            value={staged.minPrice}
            onChange={(v) => setStagedField('minPrice', v)}
            min={0}
            className="w-24"
            inputClassName="text-sm"
          />
          <span className="text-neutral-400">–</span>
          <NumberInput
            id="filter-max-price"
            placeholder="Max"
            value={staged.maxPrice}
            onChange={(v) => setStagedField('maxPrice', v)}
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
          aria-label="Sort By"
          value={staged.sort}
          onChange={(e) => setStagedField('sort', e.target.value)}
          className="input text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  const filterActions = (
    <div className="space-y-2">
      {isDirty && (
        <p className="text-xs text-neutral-500" role="status">
          {LABEL_UNAPPLIED}
        </p>
      )}
      <div className="flex gap-2">
        {showClear && (
          <button
            type="button"
            onClick={clearFilters}
            className="btn-secondary flex-1 px-3 py-2.5 text-sm"
          >
            {LABEL_CLEAR}
          </button>
        )}
        <button
          type="submit"
          disabled={!isDirty}
          className="btn-primary flex-1 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none"
        >
          {LABEL_APPLY}
        </button>
      </div>
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

      {/* Mobile drawer — fields scroll, actions stay pinned in the footer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <form
            onSubmit={applyFilters}
            className="relative ml-auto flex w-4/5 max-w-80 flex-col bg-white shadow-lg"
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="font-display text-lg font-bold text-neutral-800 flex items-center gap-2">
                Filters
                {showLoader && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
              </h3>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close filters">
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4">{filterFields}</div>
            <div className="border-t border-neutral-100 bg-white px-6 py-4">{filterActions}</div>
          </form>
        </div>
      )}

      {/* Desktop sidebar */}
      <form onSubmit={applyFilters} className="hidden lg:block">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-display text-base font-bold text-neutral-800">Filters</h3>
          {showLoader && <Loader2 className="h-4 w-4 animate-spin text-primary-500" />}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-xs font-medium text-accent-600 hover:text-accent-700"
            >
              {LABEL_CLEAR_SHORT}
            </button>
          )}
        </div>
        {filterFields}
        <div className="mt-5">{filterActions}</div>
      </form>
    </>
  )
}
