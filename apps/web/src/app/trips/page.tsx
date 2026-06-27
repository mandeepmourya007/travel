export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { fetchApiWithPagination } from '@/lib/api-server'
import { SITE_URL } from '@/lib/constants'
import { buildItemListJsonLd, buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { TripsPageClient } from '@/components/trips/trips-page-client'
import type { TripSummary } from '@shared/types/trip.types'

interface TripsPageProps {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function TripsPage({ searchParams }: TripsPageProps) {
  // `q` is the free-text search from the hero form; `destination` is the legacy
  // destination-name param (still supported for back-compat with existing links).
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
  const destination = typeof searchParams.destination === 'string' ? searchParams.destination : undefined
  const destinationId = typeof searchParams.destinationId === 'string' ? searchParams.destinationId : undefined
  const tripType = typeof searchParams.tripType === 'string' ? searchParams.tripType : undefined
  const minPrice = typeof searchParams.minPrice === 'string' ? searchParams.minPrice : undefined
  const maxPrice = typeof searchParams.maxPrice === 'string' ? searchParams.maxPrice : undefined
  const bookingMode = typeof searchParams.bookingMode === 'string' ? searchParams.bookingMode : undefined
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : 'newest'

  // Server-side fetch for SEO — Google sees real trip content
  let trips: TripSummary[] = []
  let pagination: { page: number; limit: number; total: number; totalPages: number } | null = null
  try {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (destination) params.set('destination', destination)
    if (destinationId) params.set('destinationId', destinationId)
    if (tripType) params.set('tripType', tripType)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    if (bookingMode) params.set('bookingMode', bookingMode)
    params.set('page', String(page))
    params.set('limit', '12')
    params.set('sort', sort)
    const result = await fetchApiWithPagination<TripSummary[]>(
      `/trips?${params.toString()}`,
      { revalidate: 0 },
    )
    trips = result.data
    pagination = result.pagination
  } catch {
    /* API unavailable — client hydration will retry */
  }

  const searchLabel = q || destination
  const heading = searchLabel
    ? `Search results for "${searchLabel}"`
    : 'Explore All Group Trips from Pune'

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Trips', url: `${SITE_URL}/trips` },
  ])

  return (
    <>
      {/* Structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {trips.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildItemListJsonLd(trips, SITE_URL)) }}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Server-rendered h1 + trip links for SEO */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="btn-ghost p-2" aria-label="Back to home">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-2xl font-bold text-neutral-800">
            {heading}
          </h1>
        </div>

        {/* SEO-visible trip listing (hidden after client hydration takes over) */}
        {trips.length > 0 && (
          <noscript>
            <ul>
              {trips.map((trip) => (
                <li key={trip.id}>
                  <a href={`/trips/${trip.slug}`}>{trip.title}</a>
                  {' — '}{trip.destination.name}
                  {' — '}&#x20B9;{trip.pricePerPerson}/person
                </li>
              ))}
            </ul>
          </noscript>
        )}

        {/* Invisible-to-user but crawlable trip links for Googlebot */}
        <div className="sr-only" aria-hidden="true">
          {trips.map((trip) => (
            <Link key={trip.id} href={`/trips/${trip.slug}`}>
              {trip.title} — {trip.destination.name} — Group trip starting &#x20B9;{trip.pricePerPerson}/person
            </Link>
          ))}
        </div>

        {/* Interactive client component handles filters, compare, grid */}
        <TripsPageClient
          initialData={trips.length > 0 ? { trips, pagination } : undefined}
        />
      </div>
    </>
  )
}
