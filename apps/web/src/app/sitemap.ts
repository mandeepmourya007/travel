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

  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    // Core revenue pages — highest priority
    { url: SITE_URL,                              lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE_URL}/trips`,                   lastModified: now, changeFrequency: 'daily',   priority: 0.95 },
    { url: `${SITE_URL}/destinations`,            lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },

    // Discovery & conversion pages
    { url: `${SITE_URL}/how-it-works`,            lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${SITE_URL}/faq`,                     lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${SITE_URL}/about`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.65 },
    { url: `${SITE_URL}/contact`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/safety`,                  lastModified: now, changeFrequency: 'monthly', priority: 0.6 },

    // Legal & trust pages — indexed for brand trust + LLM citation
    { url: `${SITE_URL}/legal`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/terms`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/cancellation-policy`,     lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/cookies`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/disclaimer`,              lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/rules`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/lost-item`,               lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/organizer-agreement`,     lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
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
