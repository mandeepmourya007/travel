import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import {
  lostItemSteps,
  lostItemLiabilityText,
  lostItemPreventionTips,
  lostItemAccommodationText,
  LAST_UPDATED as POLICY_DATES,
} from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Lost Item Policy | ${APP_NAME}`,
  description: `Lost something on a ${APP_NAME} trip? Learn how to report lost items, contact your organizer, and what support ${APP_NAME} can provide.`,
  alternates: { canonical: '/lost-item' },
  openGraph: {
    title: `Lost Item Policy | ${APP_NAME}`,
    description: `How to report and recover lost items from group trips booked on ${APP_NAME}.`,
    type: 'website',
    url: '/lost-item',
  },
}

export default function LostItemPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Lost Item Policy', url: `${SITE_URL}/lost-item` },
  ])

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            Lost Item Policy
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Last updated: {POLICY_DATES.lostItem}</p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            We understand how stressful it is to lose something on a trip. Here's exactly what to do and how {APP_NAME} can help.
          </p>
        </div>

        {/* Important disclaimer */}
        <div className="mb-10 rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-1">Important — Platform Limitation</h2>
          <p className="text-sm text-amber-700">
            {APP_NAME} is an intermediary marketplace and is not the trip operator. We do not manage, store, or take custody of any lost items. Trip organizers are independent service providers responsible for their vehicles, accommodation, and the conduct of their trips. However, we will assist you in every reasonable way to reconnect you with the organizer.
          </p>
        </div>

        {/* Steps */}
        {lostItemSteps.map((step) => (
          <section key={step.id} id={step.id} className="scroll-mt-20 mb-10">
            <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
              {step.title}
            </h2>
            <p className="text-sm text-neutral-600 mb-4">{step.intro}</p>
            <ul className="space-y-2 text-sm text-neutral-600 list-disc list-inside">
              {step.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
          </section>
        ))}

        {/* Liability */}
        <section id="liability" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            Liability for Lost Items
          </h2>
          <p className="text-sm text-neutral-600 mb-3">{lostItemLiabilityText.main}</p>
          <p className="text-sm text-neutral-600 mb-3">{lostItemLiabilityText.negligence}</p>
          <p className="text-sm text-neutral-600">{lostItemLiabilityText.insurance}</p>
        </section>

        {/* Prevention tips */}
        <section id="prevention" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            Preventing Loss — Travel Smart
          </h2>
          <ul className="space-y-2 text-sm text-neutral-600 list-disc list-inside">
            {lostItemPreventionTips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </section>

        {/* Items left at accommodation */}
        <section id="accommodation" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            Items Left at Accommodation
          </h2>
          <p className="text-sm text-neutral-600 mb-3">{lostItemAccommodationText.organiserBooked}</p>
          <p className="text-sm text-neutral-600">{lostItemAccommodationText.selfBooked}</p>
        </section>

        {/* Contact */}
        <div className="rounded-2xl bg-primary-50 p-6">
          <h2 className="font-semibold text-neutral-800 mb-2">Need help with a lost item?</h2>
          <p className="text-sm text-neutral-600 mb-4">
            Our support team is here to help you get in touch with your organizer as quickly as possible.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Lost Item — Booking Reference`}
            className="btn-primary text-sm inline-block"
          >
            Email Support
          </a>
          <div className="mt-4">
            <Link href="/rules" className="text-sm text-primary-600 hover:underline">
              View Community Rules &amp; Guidelines →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
