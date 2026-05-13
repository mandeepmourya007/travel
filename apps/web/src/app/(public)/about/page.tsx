import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '@/lib/structured-data'

export const metadata: Metadata = {
  title: `About ${APP_NAME} — India's Group Travel Aggregator`,
  description: `${APP_NAME} is India's first group travel aggregator. Compare trips from verified organizers, book with escrow-protected payments, and travel worry-free from Pune and beyond.`,
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: `About ${APP_NAME} — India's Group Travel Aggregator`,
    description: `${APP_NAME} is India's first group travel aggregator. Compare trips from verified organizers and book safely.`,
    type: 'website',
    url: '/about',
  },
}

export default function AboutPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'About', url: `${SITE_URL}/about` },
  ])
  const orgJsonLd = buildOrganizationJsonLd(SITE_URL, APP_NAME)

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
          About {APP_NAME}
        </h1>

        <div className="mt-8 space-y-6 text-neutral-600 leading-relaxed">
          <p>
            {APP_NAME} is India&apos;s first group travel aggregator — a platform where travelers compare, review,
            and book curated group trips from verified organizers with complete payment protection.
          </p>

          <h2 className="font-display text-xl font-bold text-neutral-800 mt-10">
            The Problem We Solve
          </h2>
          <p>
            Group travel in India is a ₹15,000+ crore market dominated by unverified operators on Instagram and WhatsApp.
            Travelers face zero payment protection, no way to compare prices, and rely entirely on trust. Organizers
            struggle with booking management, payments, and building credibility.
          </p>

          <h2 className="font-display text-xl font-bold text-neutral-800 mt-10">
            How {APP_NAME} Works
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>For Travelers:</strong> Browse and compare group trips across 14+ destinations. Read real reviews,
              check organizer ratings, and book with escrow-protected payments — your money is held safely until the trip
              is completed.
            </li>
            <li>
              <strong>For Organizers:</strong> List your trips, manage bookings, communicate with travelers, and receive
              payments through our secure escrow system. Build your reputation with verified reviews.
            </li>
          </ul>

          <h2 className="font-display text-xl font-bold text-neutral-800 mt-10">
            Why Escrow Protection Matters
          </h2>
          <p>
            When you book on {APP_NAME}, your payment is held in escrow — not released to the organizer until the trip
            is successfully completed. This means if a trip is cancelled or doesn&apos;t deliver what was promised,
            your money is protected. No more blind trust with Instagram tour operators.
          </p>

          <h2 className="font-display text-xl font-bold text-neutral-800 mt-10">
            Our Destinations
          </h2>
          <p>
            We currently feature trips across Goa, Manali, Ladakh, Rishikesh, Jaipur, Kasol, Lonavala, Udaipur,
            Spiti Valley, Coorg, Varanasi, Andaman, Meghalaya, and Hampi — with more being added every month.
            From weekend getaways to multi-day adventures, we have trips for every budget and style.
          </p>

          <div className="mt-12 flex gap-4">
            <Link
              href="/trips"
              className="btn-primary rounded-xl px-6 py-3"
            >
              Explore Trips
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-xl border border-neutral-200 px-6 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              How It Works
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
