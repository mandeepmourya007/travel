import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { termsSections, LAST_UPDATED as POLICY_DATES } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Terms of Service | ${APP_NAME}`,
  description: `Read the Terms of Service for ${APP_NAME} — India's group travel aggregator. Understand your rights and responsibilities when booking group trips on our platform.`,
  alternates: { canonical: '/terms' },
  openGraph: {
    title: `Terms of Service | ${APP_NAME}`,
    // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
    // Original: `Terms governing your use of ${APP_NAME}, India's SafePay-protected group travel platform.`
    description: `Terms governing your use of ${APP_NAME}, India's group travel platform.`,
    type: 'website',
    url: '/terms',
  },
}

export default function TermsPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Terms of Service', url: `${SITE_URL}/terms` },
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
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-neutral-400">
            Last updated: {POLICY_DATES.terms}
          </p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            Please read these Terms carefully before using {APP_NAME}. By using the platform, you agree to be bound by these Terms.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl bg-neutral-50 p-6">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">Contents</h2>
          <ol className="space-y-1 list-decimal list-inside">
            {termsSections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-primary-600 hover:underline">
                  {s.title.replace(/^\d+\.\s/, '')}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {termsSections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="font-display text-lg font-bold text-neutral-800 mb-3">
                {s.title}
              </h2>
              <div className="text-neutral-600 leading-relaxed whitespace-pre-line text-sm">
                {s.content}
              </div>
              {s.link && (
                <Link href={s.link.href} prefetch={false}
                  className="mt-3 inline-block text-sm text-primary-600 font-medium hover:underline">
                  {s.link.label}
                </Link>
              )}
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-primary-50 p-6 text-center">
          <p className="text-sm text-neutral-600">
            Questions about these terms?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 font-semibold hover:underline">
              Email us at {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </AppShell>
  )
}
