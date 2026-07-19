import type { Metadata } from 'next'
import { fetchApi, fetchApiWithPagination } from '@/lib/api-server'
import { AppShell } from '@/components/layout/app-shell'
import { HeroSearchForm } from '@/components/home/hero-search-form'
import { WelcomeModal } from '@/components/home/welcome-modal'
import { HowItWorks } from '@/components/home/how-it-works'
import { PopularDestinations } from '@/components/home/popular-destinations'
import { TrendingTrips } from '@/components/home/trending-trips'
import { WhyBookSection } from '@/components/home/why-book-section'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildWebsiteJsonLd, buildOrganizationJsonLd } from '@/lib/structured-data'
import type { TripSummary } from '@shared/types/trip.types'
import type { Destination } from '@shared/types/destination.types'

export const metadata: Metadata = {
  title: `${APP_NAME} — India's #1 Group Travel Aggregator | Compare & Book Group Trips`,
  description:
    `Compare and book curated group trips across India. Weekend getaways from Pune & Mumbai, Himalayan treks, Goa beach trips, Ladakh tours & more — all with SafePay-protected payments and verified organizers. 75+ trips, 14+ destinations.`,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
    description:
      `India's group travel aggregator. Compare 75+ group trips from verified organizers across Goa, Manali, Ladakh, Spiti & more. SafePay-protected payments. Weekend getaways from Pune, Mumbai & Bangalore.`,
    type: 'website',
    url: '/',
    siteName: APP_NAME,
    locale: 'en_IN',
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
      <WelcomeModal />
      <section className="bg-white py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <HeroSearchForm />
        </div>
      </section>
      <TrendingTrips initialData={trendingTrips} />
      <PopularDestinations initialData={destinations} />
      <WhyBookSection />
      <HowItWorks />
    </AppShell>
  )
}
