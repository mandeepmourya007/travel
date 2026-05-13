import type { MetadataRoute } from 'next'
import { fetchApi } from '@/lib/api-server'
import { SITE_URL } from '@/lib/constants'

interface SitemapData {
  trips: { slug: string; updatedAt: string }[]
  destinations: { slug: string; updatedAt: string }[]
  organizers: { slug: string; updatedAt: string }[]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let data: SitemapData = { trips: [], destinations: [], organizers: [] }

  try {
    data = await fetchApi<SitemapData>('/sitemap-data', { revalidate: 3600 })
  } catch {
    // Fallback to static-only sitemap if API is unreachable
  }

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/trips`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  const tripPages: MetadataRoute.Sitemap = data.trips.map((trip) => ({
    url: `${SITE_URL}/trips/${trip.slug}`,
    lastModified: new Date(trip.updatedAt),
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  const destinationPages: MetadataRoute.Sitemap = data.destinations.map((dest) => ({
    url: `${SITE_URL}/destinations/${dest.slug}`,
    lastModified: new Date(dest.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const organizerPages: MetadataRoute.Sitemap = data.organizers.map((org) => ({
    url: `${SITE_URL}/trips/organizers/${org.slug}`,
    lastModified: new Date(org.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticPages, ...tripPages, ...destinationPages, ...organizerPages]
}
