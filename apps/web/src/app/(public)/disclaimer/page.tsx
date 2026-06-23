import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { disclaimerSections, LAST_UPDATED as POLICY_DATES } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Disclaimer | ${APP_NAME}`,
  description: `Important disclaimer for users of ${APP_NAME}. Understand the platform's role as an intermediary marketplace and the limits of our liability for group trips in India.`,
  alternates: { canonical: '/disclaimer' },
  openGraph: {
    title: `Disclaimer | ${APP_NAME}`,
    description: `${APP_NAME} acts as an intermediary between travelers and trip organizers. Read this disclaimer before booking.`,
    type: 'website',
    url: '/disclaimer',
  },
}

export default function DisclaimerPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Disclaimer', url: `${SITE_URL}/disclaimer` },
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
            Disclaimer
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Last updated: {POLICY_DATES.disclaimer}</p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            Please read this Disclaimer carefully. It defines the limits of {APP_NAME}'s responsibility as an intermediary marketplace and sets expectations you should have before booking any trip.
          </p>
        </div>

        {/* Key notice */}
        <div className="mb-10 rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">Important — Intermediary Notice</p>
          <p className="text-sm text-amber-700">
            {APP_NAME} is a marketplace platform, not a tour operator. We connect travelers with independent organizers. The trip organizer — not {APP_NAME} — is responsible for delivering the trip you book.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl bg-neutral-50 p-6">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">Contents</h2>
          <ol className="space-y-1 list-decimal list-inside">
            {disclaimerSections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-primary-600 hover:underline">
                  {s.title.replace(/^\d+\.\s/, '')}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {disclaimerSections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="font-display text-lg font-bold text-neutral-800 mb-3">
                {s.title}
              </h2>
              <div className="text-neutral-600 leading-relaxed whitespace-pre-line text-sm">
                {s.content}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap gap-3">
          <Link href="/terms" prefetch={false} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy" prefetch={false} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/cancellation-policy" prefetch={false} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
            Cancellation Policy
          </Link>
          <Link href="/rules" prefetch={false} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
            Rules &amp; Guidelines
          </Link>
        </div>

        <div className="mt-6 rounded-2xl bg-primary-50 p-6 text-center">
          <p className="text-sm text-neutral-600">
            Questions about this Disclaimer?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 font-semibold hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </AppShell>
  )
}
