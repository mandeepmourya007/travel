import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { fetchApi } from '@/lib/api-server'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildBreadcrumbJsonLd, buildDestinationListJsonLd } from '@/lib/structured-data'
import { DestinationsListClient } from '@/components/destinations/destinations-list-client'
import type { Destination } from '@shared/types/destination.types'

export const metadata: Metadata = {
  title: `Group Trip Destinations India — Goa, Manali, Ladakh, Spiti & More | ${APP_NAME}`,
  description: `Explore 14+ group trip destinations across India. Weekend getaways from Pune & Mumbai to Lonavala, Mahabaleshwar & Goa. Adventure treks to Ladakh, Spiti Valley & Manali. Cultural tours to Rajasthan, Varanasi & Meghalaya. Book safely with ${APP_NAME}.`,
  alternates: {
    canonical: '/destinations',
  },
  openGraph: {
    title: `Group Trip Destinations India — Goa, Manali, Ladakh, Spiti & More | ${APP_NAME}`,
    // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
    // Original: `14+ group travel destinations across India. Weekend escapes, Himalayan treks, beach trips & heritage tours. Compare packages, read real reviews & book with SafePay protection.`
    description: `14+ group travel destinations across India. Weekend escapes, Himalayan treks, beach trips & heritage tours. Compare packages, read real reviews & book with secure payments.`,
    type: 'website',
    url: '/destinations',
    locale: 'en_IN',
  },
}

async function getDestinations(): Promise<Destination[]> {
  try {
    return await fetchApi<Destination[]>('/destinations', { revalidate: 3600 })
  } catch {
    // Safety net — if API is unreachable during build, don't crash; ISR will populate at runtime
    return []
  }
}

export default async function DestinationsPage() {
  const destinations = await getDestinations()

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Destinations', url: `${SITE_URL}/destinations` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {destinations.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildDestinationListJsonLd(destinations, SITE_URL)),
          }}
        />
      )}
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mt-6 flex items-center gap-3">
          <Link href="/" className="btn-ghost p-2" aria-label="Back to home">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-2xl font-bold text-neutral-900 sm:text-3xl">
            Explore Group Trip Destinations
          </h1>
        </div>
        <p className="mt-2 text-neutral-600">
          Browse {destinations.length} destinations across India
        </p>

        {/* sr-only crawlable links for SEO */}
        <nav className="sr-only" aria-label="All destinations">
          <ul>
            {destinations.map((d) => (
              <li key={d.id}>
                <a href={`/destinations/${d.slug}`}>{d.name} — {d.state}</a>
                {d.description && <p>{d.description}</p>}
              </li>
            ))}
          </ul>
        </nav>

        <DestinationsListClient destinations={destinations} />
      </div>
    </>
  )
}
