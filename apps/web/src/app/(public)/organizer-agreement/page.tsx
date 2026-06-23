import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { organizerAgreementSections, LAST_UPDATED as POLICY_DATES } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Organizer Agreement | ${APP_NAME}`,
  description: `The Organizer Agreement for trip organizers listing on ${APP_NAME}. Understand your obligations, rights, payout terms, KYC requirements, and platform rules.`,
  alternates: { canonical: '/organizer-agreement' },
  openGraph: {
    title: `Organizer Agreement | ${APP_NAME}`,
    description: `Everything trip organizers need to know before listing on ${APP_NAME}.`,
    type: 'website',
    url: '/organizer-agreement',
  },
}

export default function OrganizerAgreementPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Organizer Agreement', url: `${SITE_URL}/organizer-agreement` },
  ])

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="mb-10">
          <div className="inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 mb-4">
            For Trip Organizers
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            Organizer Agreement
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Last updated: {POLICY_DATES.organizerAgreement}</p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            This Agreement governs everything about listing and operating trips on {APP_NAME}. Read it in full before submitting your organizer application — by applying, you agree to be bound by it.
          </p>
        </div>

        {/* Key obligations summary */}
        <div className="mb-10 rounded-2xl border border-primary-100 bg-primary-50 p-6">
          <h2 className="text-sm font-semibold text-primary-800 mb-3">Key Obligations at a Glance</h2>
          <ul className="space-y-1.5 text-sm text-primary-700">
            <li>✓ Complete KYC before listing any trip</li>
            <li>✓ Maintain accurate, honest trip listings at all times</li>
            <li>✓ Meet all vehicle, guide, and safety standards outlined in Section 5</li>
            <li>✓ All payments go through the {APP_NAME} escrow — no off-platform transactions</li>
            <li>✓ Give 48+ hours notice for cancellations; all travelers get a full refund</li>
            <li>✓ Comply with GST and TDS obligations on your earnings</li>
          </ul>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl bg-neutral-50 p-6">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">Contents</h2>
          <ol className="space-y-1 list-decimal list-inside">
            {organizerAgreementSections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-primary-600 hover:underline">
                  {s.title.replace(/^\d+\.\s/, '')}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {organizerAgreementSections.map((s) => (
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

        <div className="mt-16 rounded-2xl bg-primary-50 p-6">
          <h2 className="font-semibold text-neutral-800 mb-2">Ready to list your first trip?</h2>
          <p className="text-sm text-neutral-600 mb-4">
            Sign up as an organizer, complete KYC, and start reaching travelers across India.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup?role=organizer" className="btn-primary text-sm inline-block">
              Apply as Organizer
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}?subject=Organizer Inquiry`} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors inline-block">
              Ask a Question
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
