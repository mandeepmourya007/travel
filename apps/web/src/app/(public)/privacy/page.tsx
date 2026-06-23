import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL, GRIEVANCE_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { privacySections, LAST_UPDATED as POLICY_DATES } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description: `Learn how ${APP_NAME} collects, uses, and protects your personal data. Our Privacy Policy is compliant with India's Digital Personal Data Protection Act, 2023.`,
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: `Privacy Policy | ${APP_NAME}`,
    description: `How ${APP_NAME} handles your personal data in compliance with DPDP Act, 2023.`,
    type: 'website',
    url: '/privacy',
  },
}

export default function PrivacyPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Privacy Policy', url: `${SITE_URL}/privacy` },
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
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-neutral-400">
            Last updated: {POLICY_DATES.privacy}
          </p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            Your privacy matters to us. This policy explains exactly what data we collect and how we use it.
          </p>
        </div>

        {/* DPDP Act notice */}
        <div className="mb-10 rounded-2xl border border-primary-100 bg-primary-50 p-5">
          <p className="text-sm text-primary-800 font-medium">
            This Privacy Policy is compliant with India's Digital Personal Data Protection Act, 2023 (DPDPA) and the Information Technology Act, 2000.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-10 rounded-2xl bg-neutral-50 p-6">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">Contents</h2>
          <ol className="space-y-1 list-decimal list-inside">
            {privacySections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-primary-600 hover:underline">
                  {s.title.replace(/^\d+\.\s/, '')}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {privacySections.map((s) => (
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
            Privacy concerns?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 font-semibold hover:underline">
              Reach our Grievance Officer at {GRIEVANCE_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </AppShell>
  )
}
