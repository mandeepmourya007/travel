import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchApi, getPopularTripsForStaticParams } from '@/lib/api-server'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildTripJsonLd, buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { TripDetailClient } from '@/components/trips/trip-detail-client'
import type { TripDetail } from '@shared/types/trip.types'

interface TripDetailPageProps {
  params: Promise<{ slug: string }>
}

const getTrip = cache(async (slug: string): Promise<TripDetail | null> => {
  try {
    return await fetchApi<TripDetail>(`/trips/slug/${slug}`, { revalidate: 600 })
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: TripDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const trip = await getTrip(slug)
  if (!trip) {
    return { title: 'Trip Not Found' }
  }

  const title = `${trip.title} — ${trip.destination.name} | ${APP_NAME}`
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // Original fallback: `${trip.title} to ${trip.destination.name}. ₹${trip.pricePerPerson}/person. ${Math.max(0, trip.maxGroupSize - trip.currentBookings)} seats left. Book safely with SafePay protection.`
  const raw = trip.description
    || `${trip.title} to ${trip.destination.name}. ₹${trip.pricePerPerson}/person. ${Math.max(0, trip.maxGroupSize - trip.currentBookings)} seats left. Book safely with secure payments.`
  const description = raw.length > 160
    ? raw.slice(0, raw.lastIndexOf(' ', 160)) + '…'
    : raw

  const ogImage = trip.photos[0]
    ? trip.photos[0].replace('/upload/', '/upload/w_1200,h_630,c_fill,g_auto/')
    : undefined

  return {
    title,
    description,
    alternates: {
      canonical: `/trips/${trip.slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/trips/${trip.slug}`,
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630, alt: trip.title }] }),
    },
  }
}

export async function generateStaticParams() {
  try {
    const trips = await getPopularTripsForStaticParams()
    return trips.map((t) => ({ slug: t.slug }))
  } catch {
    return []
  }
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { slug } = await params
  const trip = await getTrip(slug)

  if (!trip) {
    notFound()
  }

  // Reseller `?ref` sublink token resolution intentionally happens entirely
  // client-side (see TripDetailClient) rather than here. This route is prerendered
  // via `generateStaticParams`/ISR (10-min revalidate on trip data) for the vast
  // majority of traffic that has no `?ref`. Reading `searchParams` in a page that
  // Next has statically generated forces a Next.js "dynamic API" bailout — with no
  // Suspense boundary isolating it, that bailout throws uncaught and 500s the whole
  // route (DYNAMIC_SERVER_USAGE), not just requests that actually carry `?ref`. See
  // incident: safarnama.store/trips/* returning hard 500s in production (2026-07-21).
  const tripJsonLd = buildTripJsonLd(trip, SITE_URL)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Trips', url: `${SITE_URL}/trips` },
    { name: trip.title, url: `${SITE_URL}/trips/${trip.slug}` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tripJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <TripDetailClient trip={trip} slug={slug} />
    </>
  )
}
