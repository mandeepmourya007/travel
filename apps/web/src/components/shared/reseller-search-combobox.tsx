'use client'

import { useSearchCombobox } from '@/hooks/use-search-combobox'
import { useResellerSearch, useOrganizerSearch } from '@/hooks/use-resellers'
import { SearchCombobox } from './search-combobox'

const PAGE_SIZE = 10

interface ComboboxProps {
  value: string | undefined
  onChange: (id: string | undefined) => void
  placeholder?: string
  className?: string
}

/**
 * Reseller search combobox — organizer view is scoped to resellers already linked
 * to the organizer's own main links; admin view sees all resellers.
 * Data: GET /reseller/resellers/search (ORGANIZER/ADMIN role required)
 */
export function ResellerSearchCombobox({ value, onChange, placeholder = 'All Resellers', className }: ComboboxProps) {
  const { query, debouncedQuery, page, loadMore, handleQueryChange, accumulate } = useSearchCombobox()
  const { data, isFetching } = useResellerSearch(debouncedQuery, page, PAGE_SIZE)

  // Never surface email (PII) as combobox meta — label only.
  const items = data?.data?.map((r) => ({ id: r.id, label: r.name }))
  const { options, hasMore, isLoadingMore } = accumulate(items, data?.pagination, isFetching)

  return (
    <SearchCombobox
      value={value} onChange={onChange}
      options={options} query={query} onQueryChange={handleQueryChange}
      isLoading={isFetching && page === 1} hasMore={hasMore} onLoadMore={loadMore} isLoadingMore={isLoadingMore}
      placeholder={placeholder} searchPlaceholder="Search resellers…" allOptionLabel="All Resellers"
      className={className}
    />
  )
}

/**
 * Organizer search combobox — admin-only, lists all organizers on the platform.
 * Data: GET /reseller/organizers/search (ADMIN role required)
 */
export function OrganizerSearchCombobox({ value, onChange, placeholder = 'All Organizers', className }: ComboboxProps) {
  const { query, debouncedQuery, page, loadMore, handleQueryChange, accumulate } = useSearchCombobox()
  const { data, isFetching } = useOrganizerSearch(debouncedQuery, page, PAGE_SIZE)

  // Never surface email (PII) as combobox meta — label only.
  const items = data?.data?.map((o) => ({ id: o.id, label: o.businessName }))
  const { options, hasMore, isLoadingMore } = accumulate(items, data?.pagination, isFetching)

  return (
    <SearchCombobox
      value={value} onChange={onChange}
      options={options} query={query} onQueryChange={handleQueryChange}
      isLoading={isFetching && page === 1} hasMore={hasMore} onLoadMore={loadMore} isLoadingMore={isLoadingMore}
      placeholder={placeholder} searchPlaceholder="Search organizers…" allOptionLabel="All Organizers"
      className={className}
    />
  )
}
