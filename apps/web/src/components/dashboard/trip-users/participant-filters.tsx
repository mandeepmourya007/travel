'use client'

import { Search, XCircle } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { useState, useEffect } from 'react'

/** Filter bar for the trip participants list — search + status dropdown */
interface ParticipantFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  statusOptions: { label: string; value: string }[]
}

export function ParticipantFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
}: ParticipantFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const debouncedSearch = useDebounce(localSearch, 300)

  useEffect(() => {
    onSearchChange(debouncedSearch)
  }, [debouncedSearch, onSearchChange])

  const hasFilters = search || status

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full rounded-lg border border-neutral-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {/* Status dropdown */}
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm text-neutral-700 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
      >
        <option value="">All Statuses</option>
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => {
            setLocalSearch('')
            onSearchChange('')
            onStatusChange('')
          }}
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <XCircle className="h-4 w-4" /> Clear
        </button>
      )}
    </div>
  )
}
