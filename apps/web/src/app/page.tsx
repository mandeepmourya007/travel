import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { HeroSection } from '@/components/home/hero-section'
import { PopularDestinations } from '@/components/home/popular-destinations'
import { TrendingTrips } from '@/components/home/trending-trips'
import { WhyBookSection } from '@/components/home/why-book-section'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildWebsiteJsonLd, buildOrganizationJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = {
  title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
  description:
    'Discover and compare curated group trips from verified organizers in Pune. Escrow-protected payments, real reviews, and hassle-free travel.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
    description:
      'Discover and compare curated group trips from verified organizers in Pune. Escrow-protected payments, real reviews, and hassle-free travel.',
    type: 'website',
    url: '/',
    siteName: APP_NAME,
  },
}

export default function HomePage() {
  const websiteJsonLd = buildWebsiteJsonLd(SITE_URL, APP_NAME)
  const organizationJsonLd = buildOrganizationJsonLd(SITE_URL, APP_NAME)

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
      <PopularDestinations />
      <TrendingTrips />
      <WhyBookSection />
    </AppShell>
  )
}
