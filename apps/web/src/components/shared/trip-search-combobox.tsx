'use client'

import { useSearchCombobox } from '@/hooks/use-search-combobox'
import { useMyTripsSearch, useTravelerTripsSearch, useAdminTripsSearch } from '@/hooks/use-my-trips'
import { SearchCombobox } from './search-combobox'

const PAGE_SIZE = 10

interface TripComboboxProps {
  value: string | undefined
  onChange: (tripId: string | undefined) => void
  placeholder?: string
  className?: string
}

function useTripComboboxUI(data: ReturnType<typeof useMyTripsSearch>['data'], isFetching: boolean, setPage: (p: number) => void) {
  const options = (data?.data ?? []).map((t) => ({ id: t.id, label: t.title, meta: t.destination.name }))
  const pagination = data?.pagination
    ? { page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total, onPageChange: setPage }
    : undefined
  return { options, pagination, isFetching }
}

/**
 * Organizer trip search combobox — shows only trips owned by the logged-in organizer.
 * Data: GET /trips/my/search (ORGANIZER role required)
 */
export function TripSearchCombobox({ value, onChange, placeholder = 'All Trips', className }: TripComboboxProps) {
  const { query, debouncedQuery, page, setPage, handleQueryChange } = useSearchCombobox()
  const { data, isFetching } = useMyTripsSearch(debouncedQuery, page, PAGE_SIZE)
  const { options, pagination } = useTripComboboxUI(data, isFetching, setPage)

  return (
    <SearchCombobox
      value={value} onChange={onChange}
      options={options} query={query} onQueryChange={handleQueryChange}
      isLoading={isFetching} pagination={pagination}
      placeholder={placeholder} searchPlaceholder="Search trips…" allOptionLabel="All Trips"
      className={className}
    />
  )
}

/**
 * Traveler trip search combobox — shows only trips the logged-in traveler has booked.
 * Data: GET /trips/my/booked-search (TRAVELER / ADMIN role required)
 */
export function TravelerTripSearchCombobox({ value, onChange, placeholder = 'All Trips', className }: TripComboboxProps) {
  const { query, debouncedQuery, page, setPage, handleQueryChange } = useSearchCombobox()
  const { data, isFetching } = useTravelerTripsSearch(debouncedQuery, page, PAGE_SIZE)
  const { options, pagination } = useTripComboboxUI(data, isFetching, setPage)

  return (
    <SearchCombobox
      value={value} onChange={onChange}
      options={options} query={query} onQueryChange={handleQueryChange}
      isLoading={isFetching} pagination={pagination}
      placeholder={placeholder} searchPlaceholder="Search trips…" allOptionLabel="All Trips"
      className={className}
    />
  )
}

/**
 * Admin trip search combobox — shows all trips on the platform.
 * Data: GET /trips/admin/search (ADMIN role required)
 */
export function AdminTripSearchCombobox({ value, onChange, placeholder = 'All Trips', className }: TripComboboxProps) {
  const { query, debouncedQuery, page, setPage, handleQueryChange } = useSearchCombobox()
  const { data, isFetching } = useAdminTripsSearch(debouncedQuery, page, PAGE_SIZE)
  const { options, pagination } = useTripComboboxUI(data, isFetching, setPage)

  return (
    <SearchCombobox
      value={value} onChange={onChange}
      options={options} query={query} onQueryChange={handleQueryChange}
      isLoading={isFetching} pagination={pagination}
      placeholder={placeholder} searchPlaceholder="Search trips…" allOptionLabel="All Trips"
      className={className}
    />
  )
}
