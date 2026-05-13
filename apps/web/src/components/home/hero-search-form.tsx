'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function HeroSearchForm() {
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
    <form
      onSubmit={handleSearch}
      className="mx-auto mt-10 flex max-w-lg items-center gap-2"
    >
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Where do you want to go?"
          className="h-auto rounded-xl bg-white py-3.5 pl-12 pr-4 text-base text-neutral-800 shadow-sm"
        />
      </div>
      <button type="submit" className="btn-primary rounded-xl px-6 py-3.5 shadow-md">
        Search
      </button>
    </form>
  )
}
