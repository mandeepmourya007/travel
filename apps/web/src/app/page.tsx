import type { Metadata } from 'next'
import { fetchApi, fetchApiWithPagination } from '@/lib/api-server'
import { AppShell } from '@/components/layout/app-shell'
import { HeroSection } from '@/components/home/hero-section'
import { HowItWorks } from '@/components/home/how-it-works'
import { PopularDestinations } from '@/components/home/popular-destinations'
import { TrendingTrips } from '@/components/home/trending-trips'
import { WhyBookSection } from '@/components/home/why-book-section'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildWebsiteJsonLd, buildOrganizationJsonLd } from '@/lib/structured-data'
import type { TripSummary } from '@shared/types/trip.types'
import type { Destination } from '@shared/types/destination.types'

export const metadata: Metadata = {
  title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
  description:
    'Discover and compare curated group trips from verified organizers in Pune. SafePay-protected payments, real reviews, and hassle-free travel.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
    description:
      'Discover and compare curated group trips from verified organizers in Pune. SafePay-protected payments, real reviews, and hassle-free travel.',
    type: 'website',
    url: '/',
    siteName: APP_NAME,
  },
}

export default async function HomePage() {
  const websiteJsonLd = buildWebsiteJsonLd(SITE_URL, APP_NAME)
  const organizationJsonLd = buildOrganizationJsonLd(SITE_URL, APP_NAME)

  // SSR-fetch homepage data in parallel — eliminates client-side waterfall
  const [destinations, tripsResult] = await Promise.all([
    fetchApi<Destination[]>('/destinations?popular=true', { revalidate: 300 }).catch(() => []),
    fetchApiWithPagination<TripSummary[]>('/trips?sort=trending&limit=6', { revalidate: 900 }).catch(() => null),
  ])

  const trendingTrips = tripsResult
    ? { trips: tripsResult.data, pagination: tripsResult.pagination }
    : undefined

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <HeroSection />
      <HowItWorks />
      <PopularDestinations initialData={destinations} />
      <TrendingTrips initialData={trendingTrips} />
      <WhyBookSection />
    </AppShell>
  )
}
