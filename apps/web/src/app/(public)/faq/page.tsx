import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL } from '@/lib/constants'
import { buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/structured-data'
import { faqs } from '@/lib/legal-content'

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
              {faq.link && (
                <Link
                  href={faq.link.href}
                  prefetch={false}
                  className="mt-2 inline-block text-sm text-primary-600 font-medium hover:underline"
                >
                  {faq.link.label}
                </Link>
              )}
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
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link href="/terms" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/cancellation-policy" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
              Cancellation Policy
            </Link>
            <Link href="/rules" prefetch={false} className="text-sm text-neutral-500 hover:text-primary-600 transition-colors">
              Rules &amp; Guidelines
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
