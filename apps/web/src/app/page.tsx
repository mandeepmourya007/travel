import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
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
    <>
      <Header />
      <main className="min-h-screen">
        <HeroSection />
        <PopularDestinations />
        <TrendingTrips />
        <WhyBookSection />
      </main>
      <Footer />
    </>
  )
}
