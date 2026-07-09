import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { Search, Shield, CreditCard, MapPin, Star, MessageCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: `How It Works — Book Group Trips Safely | ${APP_NAME}`,
  description: `Learn how ${APP_NAME} works: compare group trips, book with SafePay-protected payments, and travel safely with verified organizers. Step-by-step guide for travelers and organizers.`,
  alternates: {
    canonical: '/how-it-works',
  },
  openGraph: {
    title: `How It Works — Book Group Trips Safely | ${APP_NAME}`,
    description: `Step-by-step guide: compare group trips, book with SafePay protection, and travel safely.`,
    type: 'website',
    url: '/how-it-works',
  },
}

const travelerSteps = [
  {
    icon: Search,
    title: 'Compare Trips',
    description: 'Browse trips across 14+ destinations. Filter by price, type, dates, and ratings. Use our side-by-side comparison tool to pick the best trip for you.',
  },
  {
    icon: Shield,
    title: 'Book with SafePay Protection',
    description: 'Your payment is held safely via SafePay — not released to the organizer until your trip is completed. If the trip is cancelled, you get a full refund automatically.',
  },
  {
    icon: CreditCard,
    title: 'Secure Payment via Razorpay',
    description: 'Pay via UPI, credit/debit card, or net banking. All transactions are processed through Razorpay with bank-grade security. Early bird discounts available on many trips.',
  },
  {
    icon: MapPin,
    title: 'Travel with Confidence',
    description: 'Get pickup point details, itinerary, and direct chat with your organizer. Choose your seat in the vehicle, track trip updates, and enjoy well-organised group travel.',
  },
  {
    icon: Star,
    title: 'Review Your Experience',
    description: 'After your trip, rate the organizer on organization, value, safety, and accuracy. Your honest reviews help future travelers make better decisions.',
  },
  {
    icon: MessageCircle,
    title: 'Get Support Anytime',
    description: 'Chat directly with organizers before booking. Our admin support team is available for payment issues, disputes, and any concerns during your trip.',
  },
]

export default function HowItWorksPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'How It Works', url: `${SITE_URL}/how-it-works` },
  ])

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            How {APP_NAME} Works
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-500">
            Book group trips safely in 3 simple steps — compare, book with SafePay protection, and travel with confidence.
          </p>
        </div>

        <h2 className="font-display text-2xl font-bold text-neutral-800 mt-16 mb-8">
          For Travelers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {travelerSteps.map((step, i) => (
            <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
                <step.icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-neutral-800">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-500 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <h2 className="font-display text-2xl font-bold text-neutral-800 mt-16 mb-6">
          For Organizers
        </h2>
        <div className="space-y-4 text-neutral-600 leading-relaxed">
          <p>
            {APP_NAME} gives trip organizers a professional platform to list trips, manage bookings,
            and build credibility. Here&apos;s what you get:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Trip Listings:</strong> Create detailed trip pages with itineraries, photos, pricing, and inclusions/exclusions.</li>
            <li><strong>Booking Management:</strong> Instant booking or request-based approval flow. Manage traveler details, payments, and communications.</li>
            <li><strong>Seat Selection:</strong> Optionally enable vehicle seat maps so travelers can choose their seats.</li>
            <li><strong>Reviews & Ratings:</strong> Build trust with verified post-trip reviews. Respond to reviews publicly.</li>
            <li><strong>Secure Payouts:</strong> Receive payouts after trip completion via SafePay. 10% platform commission.</li>
            <li><strong>Dashboard:</strong> Track bookings, revenue, pending requests, and trip performance from a single dashboard.</li>
          </ul>
        </div>

        <div className="mt-16 rounded-2xl bg-primary-50 p-8 text-center">
          <h2 className="font-display text-xl font-bold text-neutral-800">
            Ready to explore?
          </h2>
          <p className="mt-2 text-neutral-600">
            Browse 75+ trips across India or list your first trip as an organizer.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/trips" className="btn-primary rounded-xl px-6 py-3">
              Browse Trips
            </Link>
            <Link
              href="/faq"
              className="rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Read FAQ
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
