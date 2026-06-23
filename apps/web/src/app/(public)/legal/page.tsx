import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL, GRIEVANCE_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { legalDocuments } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Legal | ${APP_NAME}`,
  description: `All legal documents for ${APP_NAME} — Terms of Service, Privacy Policy, Cookie Policy, Cancellation Policy, Community Rules, Disclaimer, and the Organizer Agreement in one place.`,
  alternates: { canonical: '/legal' },
  openGraph: {
    title: `Legal | ${APP_NAME}`,
    description: `All legal documents for ${APP_NAME} in one place.`,
    type: 'website',
    url: '/legal',
  },
}

const audienceColors: Record<string, string> = {
  'All users': 'bg-neutral-100 text-neutral-600',
  'Travelers': 'bg-primary-100 text-primary-700',
  'Organizers': 'bg-success-50 text-success-500',
}

export default function LegalHubPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Legal', url: `${SITE_URL}/legal` },
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
            Legal
          </h1>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            All {APP_NAME} legal documents in one place. Documents marked with a star are required reading before booking or listing a trip.
          </p>
        </div>

        {/* Governing law notice */}
        <div className="mb-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <p className="text-sm text-neutral-600">
            All documents on this page are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of courts in Pune, Maharashtra. If you have questions, email our Grievance Officer at{' '}
            <a href={`mailto:${GRIEVANCE_EMAIL}`} className="text-primary-600 hover:underline font-medium">{GRIEVANCE_EMAIL}</a>.
          </p>
        </div>

        {/* Policies grid */}
        <div className="space-y-4 mb-12">
          {legalDocuments.map((policy) => (
            <Link
              key={policy.href}
              href={policy.href}
              prefetch={false}
              className="group block rounded-2xl border border-neutral-200 bg-white p-5 hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-display text-base font-bold text-neutral-800 group-hover:text-primary-700 transition-colors">
                      {policy.title}
                    </h2>
                    {policy.required && (
                      <span className="inline-block flex-shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-500">
                        Required reading
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 leading-relaxed">{policy.description}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${audienceColors[policy.audience]}`}>
                      {policy.audience}
                    </span>
                    <span className="text-xs text-neutral-400">Updated {policy.lastUpdated}</span>
                  </div>
                </div>
                <span className="flex-shrink-0 text-neutral-300 group-hover:text-primary-400 transition-colors mt-1">→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Contact section */}
        <div className="rounded-2xl bg-primary-50 p-6">
          <h2 className="font-display font-bold text-neutral-800 mb-2">Legal Questions?</h2>
          <p className="text-sm text-neutral-600 mb-4">
            For general questions about these documents, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 font-medium hover:underline">{CONTACT_EMAIL}</a>.
            For formal grievances, use{' '}
            <a href={`mailto:${GRIEVANCE_EMAIL}`} className="text-primary-600 font-medium hover:underline">{GRIEVANCE_EMAIL}</a>.
          </p>
          <Link href="/contact" prefetch={false} className="text-sm font-medium text-primary-700 hover:underline">
            View all contact options →
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
