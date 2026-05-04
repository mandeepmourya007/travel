import { AppShell } from '@/components/layout/app-shell'
import { HeroSection } from '@/components/home/hero-section'
import { PopularDestinations } from '@/components/home/popular-destinations'
import { TrendingTrips } from '@/components/home/trending-trips'
import { WhyBookSection } from '@/components/home/why-book-section'
import type { Metadata } from 'next'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
  description:
    'Discover and compare curated group trips from verified organizers in Pune. Escrow-protected payments, real reviews, and hassle-free travel.',
  openGraph: {
    title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
    description:
      'Discover and compare curated group trips from verified organizers in Pune.',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <AppShell>
      <HeroSection />
      <PopularDestinations />
      <TrendingTrips />
      <WhyBookSection />
    </AppShell>
  )
}
