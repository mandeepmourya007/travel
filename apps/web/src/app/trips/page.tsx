import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { fetchApiWithPagination } from '@/lib/api-server'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildItemListJsonLd, buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { TripsPageClient } from '@/components/trips/trips-page-client'
import type { TripSummary } from '@shared/types/trip.types'

// `searchParams` is a Next 15 dynamic API, which already opts the route into
// dynamic rendering — no `export const dynamic = 'force-dynamic'` needed.

interface TripsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Max length for a user-supplied search label reflected into <title>/<meta description>. */
const MAX_SEARCH_LABEL_LENGTH = 60

/**
 * Parse the /trips query string into a normalised, typed shape.
 *
 * Extracted from the page component so `generateMetadata` and the page body
 * see the same parsed values (single source of truth). Numeric fields (page)
 * are coerced; string fields are only accepted as `string` (arrays rejected).
 */
function parseTripsSearchParams(sp: Record<string, string | string[] | undefined>) {
  const s = (key: string): string | undefined => (typeof sp[key] === 'string' ? (sp[key] as string) : undefined)
  return {
    q: s('q'),
    destination: s('destination'),
    destinationId: s('destinationId'),
    tripType: s('tripType'),
    minPrice: s('minPrice'),
    maxPrice: s('maxPrice'),
    bookingMode: s('bookingMode'),
    sort: s('sort') ?? 'newest',
    page: typeof sp.page === 'string' ? Number(sp.page) || 1 : 1,
  }
}

/** Strip control chars / HTML-ish chars and cap length — prevents junk SERP entries from crafted `?q=` values. */
function sanitizeSearchLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[<>\r\n\t]/g, '').trim()
  if (!cleaned) return undefined
  return cleaned.length > MAX_SEARCH_LABEL_LENGTH ? cleaned.slice(0, MAX_SEARCH_LABEL_LENGTH) : cleaned
}

/**
 * SEO metadata for /trips.
 *
 * Canonical strategy: filtered/search views are non-canonical (they consolidate
 * to /trips) to avoid diluting rankings across near-duplicate query permutations.
 * Filtered views also carry noindex to keep query-space out of the index while
 * still being crawlable via internal links + sitemap trip URLs.
 */
export async function generateMetadata({ searchParams: searchParamsPromise }: TripsPageProps): Promise<Metadata> {
  const params = parseTripsSearchParams(await searchParamsPromise)
  const label = sanitizeSearchLabel(params.q || params.destination)
  const isFiltered = Boolean(
    label ||
      params.tripType ||
      params.minPrice ||
      params.maxPrice ||
      params.destinationId ||
      params.bookingMode,
  )
  const isPaginated = params.page > 1

  const title = label
    ? `${label} — Group Trips in India | ${APP_NAME}`
    : `Group Trips in India — Compare & Book | ${APP_NAME}`

  const description = label
    ? `Compare group trips to ${label}. Verified organizers, transparent pricing, real traveler reviews. Book with secure payments on ${APP_NAME}.`
    : `Browse group trip packages across Indian destinations. Weekend getaways from Pune, Mumbai, Delhi & Bangalore. Verified organizers, secure payments, real reviews.`

  return {
    title,
    description,
    alternates: {
      // Filtered/paginated views collapse to /trips to prevent near-duplicate ranking dilution.
      canonical: '/trips',
    },
    // Keep filtered/paginated permutations crawlable but out of index.
    robots: isFiltered || isPaginated ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      type: 'website',
      url: '/trips',
      siteName: APP_NAME,
      locale: 'en_IN',
    },
  }
}

export default async function TripsPage({ searchParams: searchParamsPromise }: TripsPageProps) {
  const searchParams = await searchParamsPromise
  // `q` is the free-text search from the hero form; `destination` is the legacy
  // destination-name param (still supported for back-compat with existing links).
  const { q, destination, destinationId, tripType, minPrice, maxPrice, bookingMode, sort, page } =
    parseTripsSearchParams(searchParams)

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
      { revalidate: 30 },
    )
    trips = result.data
    pagination = result.pagination
  } catch {
    /* API unavailable — client hydration will retry */
  }

  const searchLabel = q || destination
  const heading = searchLabel
    ? `Search results for "${searchLabel}"`
    : 'Explore All Group Trips'

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
