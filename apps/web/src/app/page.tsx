import type { Metadata } from 'next'
import Image from 'next/image'
import { fetchApi, fetchApiWithPagination } from '@/lib/api-server'
import { AppShell } from '@/components/layout/app-shell'
import { HeroBackground } from '@/components/home/hero-background'
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
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // Original: `Compare and book curated group trips across India. Weekend getaways from Pune & Mumbai, Himalayan treks, Goa beach trips, Ladakh tours & more — all with SafePay-protected payments and verified organizers. 75+ trips, 14+ destinations.`
  description:
    `Compare and book curated group trips across India. Weekend getaways from Pune & Mumbai, Himalayan treks, Goa beach trips, Ladakh tours & more — all with secure payments and verified organizers. 75+ trips, 14+ destinations.`,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
    // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
    // Original: `India's group travel aggregator. Compare 75+ group trips from verified organizers across Goa, Manali, Ladakh, Spiti & more. SafePay-protected payments. Weekend getaways from Pune, Mumbai & Bangalore.`
    description:
      `India's group travel aggregator. Compare 75+ group trips from verified organizers across Goa, Manali, Ladakh, Spiti & more. Secure payments. Weekend getaways from Pune, Mumbai & Bangalore.`,
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
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white py-14 sm:py-20">
        <HeroBackground />

        <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Image
            src="/logo-prod.svg"
            alt={APP_NAME}
            width={380}
            height={120}
            priority
            className="mx-auto h-16 w-auto sm:h-24"
          />
          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-primary-600/60 sm:text-xs">
            Explore <span className="text-accent-500/70">&middot;</span> Enjoy{' '}
            <span className="text-accent-500/70">&middot;</span> Experience
          </p>
          <h1 className="mt-5 font-display text-2xl font-bold text-neutral-900 sm:text-3xl">
            Find your next group trip
          </h1>
          <p className="mt-2 text-sm text-neutral-500 sm:text-base">
            Compare verified organizers and book weekend getaways, treks & beach trips across India.
          </p>
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
