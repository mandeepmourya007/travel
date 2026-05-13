import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchApi } from '@/lib/api-server'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildDestinationJsonLd, buildBreadcrumbJsonLd, buildItemListJsonLd } from '@/lib/structured-data'
import { DestinationDetailClient } from '@/components/destinations/destination-detail-client'
import type { DestinationDetailResponse } from '@shared/types/destination.types'

interface DestinationPageProps {
  params: { slug: string }
}

const getDestination = cache(async (slug: string): Promise<DestinationDetailResponse | null> => {
  try {
    return await fetchApi<DestinationDetailResponse>(`/destinations/slug/${slug}`, { revalidate: 300 })
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: DestinationPageProps): Promise<Metadata> {
  const data = await getDestination(params.slug)
  if (!data) {
    return { title: 'Destination Not Found' }
  }

  const { destination, stats } = data
  const priceText = stats.minPrice > 0 ? ` Starting from ₹${stats.minPrice}/person.` : ''
  const title = `${destination.name} — Trips & Packages | ${APP_NAME}`
  const raw = destination.description
    || `Explore ${destination.tripCount} group trips to ${destination.name}, ${destination.state}.${priceText}`
  const description = raw.length > 160
    ? raw.slice(0, raw.lastIndexOf(' ', 160)) + '…'
    : raw

  const ogImage = destination.photoUrl
    ? destination.photoUrl.replace('/upload/', '/upload/w_1200,h_630,c_fill,g_auto/')
    : undefined

  return {
    title,
    description,
    alternates: {
      canonical: `/destinations/${destination.slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/destinations/${destination.slug}`,
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630, alt: destination.name }] }),
    },
  }
}

export async function generateStaticParams() {
  try {
    const data = await fetchApi<{ destinations: { slug: string }[] }>('/sitemap-data', { revalidate: 3600 })
    return data.destinations.map((dest) => ({ slug: dest.slug }))
  } catch {
    return []
  }
}

export default async function DestinationPage({ params }: DestinationPageProps) {
  const data = await getDestination(params.slug)

  if (!data) {
    notFound()
  }

  const { destination, trips } = data
  const destinationJsonLd = buildDestinationJsonLd(destination, SITE_URL, destination.slug)
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Destinations', url: `${SITE_URL}/destinations` },
    { name: destination.name, url: `${SITE_URL}/destinations/${destination.slug}` },
  ])
  const itemListJsonLd = trips.length > 0 ? buildItemListJsonLd(trips, SITE_URL) : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(destinationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <DestinationDetailClient initialData={data} slug={params.slug} />
    </>
  )
}
