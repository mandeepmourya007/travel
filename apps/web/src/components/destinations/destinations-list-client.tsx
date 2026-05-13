'use client'

import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { DestinationCard } from './destination-card'
import { cn } from '@/lib/utils'
import type { Destination } from '@shared/types/destination.types'

interface DestinationsListClientProps {
  destinations: Destination[]
}

export function DestinationsListClient({ destinations }: DestinationsListClientProps) {
  const [search, setSearch] = useState('')
  const [selectedState, setSelectedState] = useState<string | null>(null)

  const states = useMemo(() => {
    const stateSet = new Set(destinations.map((d) => d.state))
    return Array.from(stateSet).sort()
  }, [destinations])

  const filtered = useMemo(() => {
    let result = destinations
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (d) => d.name.toLowerCase().includes(q) || d.state.toLowerCase().includes(q),
      )
    }
    if (selectedState) {
      result = result.filter((d) => d.state === selectedState)
    }
    return result
  }, [destinations, search, selectedState])

  return (
    <>
      {/* Search */}
      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          placeholder="Search destinations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full pl-10 pr-10"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* State tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedState(null)}
          className={cn(
            'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            selectedState === null
              ? 'bg-primary-600 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
          )}
        >
          All
        </button>
        {states.map((state) => (
          <button
            key={state}
            onClick={() => setSelectedState(selectedState === state ? null : state)}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              selectedState === state
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
            )}
          >
            {state}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      ) : (
        <div className="mt-12 rounded-xl bg-neutral-50 p-12 text-center">
          <p className="text-neutral-500">No destinations found.</p>
          {(search || selectedState) && (
            <button
              onClick={() => {
                setSearch('')
                setSelectedState(null)
              }}
              className="btn-outline mt-4"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  )
}
