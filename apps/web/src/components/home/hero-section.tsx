'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'

export function HeroSection() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/trips?destination=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/trips')
    }
  }

  return (
    <section className="relative bg-gradient-to-br from-primary-50 via-white to-highlight-50 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          Compare Group Trips.{' '}
          <span className="text-primary-600">Book Safely.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-500 leading-relaxed">
          Discover curated group trips from verified organizers. Escrow-protected
          payments, real reviews, and hassle-free travel from Pune.
        </p>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="mx-auto mt-10 flex max-w-lg items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Where do you want to go?"
              className="w-full rounded-xl border border-neutral-200 bg-white py-3.5 pl-12 pr-4 text-base text-neutral-800 shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>
          <button type="submit" className="btn-primary rounded-xl px-6 py-3.5 shadow-md">
            Search
          </button>
        </form>
      </div>
    </section>
  )
}
