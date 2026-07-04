'use client'

import { useSearchCombobox } from '@/hooks/use-search-combobox'
import { useMyTripsSearch } from '@/hooks/use-my-trips'
import { SearchCombobox } from './search-combobox'

const PAGE_SIZE = 10

interface TripSearchComboboxProps {
  value: string | undefined
  onChange: (tripId: string | undefined) => void
  placeholder?: string
  className?: string
}

/**
 * Organizer trip search combobox.
 *
 * Composes useSearchCombobox (state) + useMyTripsSearch (data) + SearchCombobox (UI).
 * To add a different data source (admin trips, traveler trips), create a new
 * wrapper following the same pattern — reuse SearchCombobox and useSearchCombobox.
 */
export function TripSearchCombobox({
  value,
  onChange,
  placeholder = 'All Trips',
  className,
}: TripSearchComboboxProps) {
  const { query, debouncedQuery, page, setPage, handleQueryChange } = useSearchCombobox()
  const { data, isFetching } = useMyTripsSearch(debouncedQuery, page, PAGE_SIZE)

  const options = (data?.data ?? []).map((t) => ({
    id: t.id,
    label: t.title,
    meta: t.destination.name,
  }))

  const pagination = data?.pagination
    ? {
        page: data.pagination.page,
        totalPages: data.pagination.totalPages,
        total: data.pagination.total,
        onPageChange: setPage,
      }
    : undefined

  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      options={options}
      query={query}
      onQueryChange={handleQueryChange}
      isLoading={isFetching}
      pagination={pagination}
      placeholder={placeholder}
      searchPlaceholder="Search trips…"
      allOptionLabel="All Trips"
      className={className}
    />
  )
}
