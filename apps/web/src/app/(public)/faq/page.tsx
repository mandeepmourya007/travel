import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/structured-data'

const faqs = [
  {
    question: 'What is escrow payment protection?',
    answer: `When you book a trip on ${APP_NAME}, your payment is held in a secure escrow account powered by Razorpay. The money is NOT released to the organizer until the trip is successfully completed. If the trip is cancelled by the organizer, you receive an automatic full refund. This protects you from scams and ensures organizers deliver on their promises.`,
  },
  {
    question: 'How do I book a group trip?',
    answer: 'Browse trips on our platform, select one that matches your interests, and click "Book Now". For instant-booking trips, you pay and your seat is confirmed immediately. For request-based trips, the organizer reviews your request first and then sends you a payment link upon approval.',
  },
  {
    question: 'Are the trip organizers verified?',
    answer: `Yes! Every organizer on ${APP_NAME} goes through a verification process. We check their business documents, past trip history, and customer reviews. Only approved organizers can list trips. You can see their rating, review count, and completed trip history on their profile page.`,
  },
  {
    question: 'What happens if a trip is cancelled?',
    answer: 'If an organizer cancels a trip, you receive a full refund from the escrow account automatically. If you cancel, the refund depends on the trip\'s cancellation policy — Flexible (full refund up to 7 days before), Moderate (50% refund up to 7 days before), or Strict (no refund within 14 days of the trip).',
  },
  {
    question: 'Can I compare trips side by side?',
    answer: 'Yes! Use our comparison tool to compare up to 3 trips side by side. Compare prices, itineraries, inclusions, organizer ratings, and more. Click the "Compare" button on any trip card to add it to your comparison queue.',
  },
  {
    question: 'What payment methods are accepted?',
    answer: 'We accept all major payment methods through Razorpay — UPI (Google Pay, PhonePe, Paytm), credit/debit cards (Visa, Mastercard, RuPay), net banking, and wallets. All transactions are encrypted with bank-grade security.',
  },
  {
    question: 'How do early bird discounts work?',
    answer: 'Many trips offer early bird pricing — a discounted rate if you book before a certain date. The early bird deadline is shown on the trip page. Once the deadline passes, the price reverts to the regular rate. Book early to save!',
  },
  {
    question: 'Can I choose my seat in the vehicle?',
    answer: 'Some trips offer seat selection. If the organizer has enabled it, you\'ll see a seat map during booking where you can pick your preferred seat. Available, held, and booked seats are clearly marked.',
  },
  {
    question: 'How do reviews work?',
    answer: 'Only travelers who have completed a trip can leave reviews. You rate the organizer on 4 criteria: organization, value for money, safety, and accuracy (how well the trip matched its description). Organizers can respond to reviews publicly. This ensures authentic feedback.',
  },
  {
    question: 'Is my personal information safe?',
    answer: `${APP_NAME} takes privacy seriously. We never share your personal data with third parties. Organizers only see the information needed to manage your booking (name, phone, emergency contact). Payments are processed securely through Razorpay — we never store your card details.`,
  },
  {
    question: 'What destinations do you cover?',
    answer: 'We currently feature trips across Goa, Manali, Ladakh, Rishikesh, Jaipur, Kasol, Lonavala, Udaipur, Spiti Valley, Coorg, Varanasi, Andaman Islands, Meghalaya, and Hampi. New destinations are added regularly. Most trips depart from Pune, Delhi, Mumbai, or Bangalore.',
  },
  {
    question: 'How can I become a trip organizer?',
    answer: `Submit an organizer application through ${APP_NAME}. You'll need to provide your business details, past trip experience, and identification documents. Our team reviews applications within 48 hours. Once approved, you can start listing trips immediately.`,
  },
]

export const metadata: Metadata = {
  title: `FAQ — Group Travel Questions Answered | ${APP_NAME}`,
  description: `Frequently asked questions about ${APP_NAME}. Learn about escrow payment protection, booking process, cancellation policies, organizer verification, and more.`,
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: `FAQ — Group Travel Questions Answered | ${APP_NAME}`,
    description: `Get answers to common questions about booking group trips, escrow payments, cancellations, and organizer verification.`,
    type: 'website',
    url: '/faq',
  },
}

export default function FaqPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'FAQ', url: `${SITE_URL}/faq` },
  ])
  const faqJsonLd = buildFaqJsonLd(faqs)

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-500">
            Everything you need to know about booking group trips safely on {APP_NAME}.
          </p>
        </div>

        <div className="mt-12 space-y-8">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-neutral-100 pb-8 last:border-0">
              <h2 className="font-display text-lg font-bold text-neutral-800">
                {faq.question}
              </h2>
              <p className="mt-3 text-neutral-600 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-primary-50 p-8 text-center">
          <h2 className="font-display text-xl font-bold text-neutral-800">
            Still have questions?
          </h2>
          <p className="mt-2 text-neutral-600">
            Browse our trips or reach out to our support team.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/trips" className="btn-primary rounded-xl px-6 py-3">
              Explore Trips
            </Link>
            <Link
              href="/about"
              className="rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              About Us
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
