import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { travelerRuleGroups, organizerRuleGroups, rulesReportingText, LAST_UPDATED as POLICY_DATES } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Community Rules & Guidelines | ${APP_NAME}`,
  description: `Rules and guidelines for travelers and trip organizers on ${APP_NAME}. Understand expectations for safe, respectful, and responsible group travel in India.`,
  alternates: { canonical: '/rules' },
  openGraph: {
    title: `Community Rules & Guidelines | ${APP_NAME}`,
    description: `Guidelines for travelers and organizers on ${APP_NAME} — India's group travel platform.`,
    type: 'website',
    url: '/rules',
  },
}

export default function RulesPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Rules & Guidelines', url: `${SITE_URL}/rules` },
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
            Community Rules &amp; Guidelines
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Last updated: {POLICY_DATES.rules}</p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            {APP_NAME} is built on trust. These guidelines ensure every trip is safe, enjoyable, and respectful for everyone involved — travelers, organizers, local communities, and the environment.
          </p>
        </div>

        {/* For Travelers */}
        <section id="travelers" className="scroll-mt-20 mb-14">
          <h2 className="font-display text-2xl font-bold text-neutral-900 mb-6">
            For Travelers
          </h2>

          <div className="space-y-8">
            {travelerRuleGroups.map((group) => (
              <div key={group.id} id={group.id}>
                <h3 className="font-semibold text-neutral-800 mb-2">{group.title}</h3>
                <ul className="space-y-1.5 text-sm text-neutral-600 list-disc list-inside">
                  {group.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-neutral-200 mb-14" />

        {/* For Organizers */}
        <section id="organizers" className="scroll-mt-20 mb-14">
          <h2 className="font-display text-2xl font-bold text-neutral-900 mb-6">
            For Trip Organizers
          </h2>

          <div className="space-y-8">
            {organizerRuleGroups.map((group) => (
              <div key={group.id} id={group.id}>
                <h3 className="font-semibold text-neutral-800 mb-2">{group.title}</h3>
                <ul className="space-y-1.5 text-sm text-neutral-600 list-disc list-inside">
                  {group.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Reporting Violations */}
        <section id="reporting" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            Reporting a Violation
          </h2>
          <p className="text-sm text-neutral-600">{rulesReportingText.intro}</p>
          <ul className="mt-3 space-y-1.5 text-sm text-neutral-600 list-disc list-inside">
            {rulesReportingText.channels.map((channel, i) => (
              <li key={i}>
                {i === 1 ? (
                  <>Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">{CONTACT_EMAIL}</a> with your booking reference and a description of the incident</>
                ) : channel}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-neutral-600">{rulesReportingText.followUp}</p>
        </section>

        <div className="rounded-2xl bg-primary-50 p-6 text-center">
          <p className="text-sm text-neutral-600">
            Questions about these guidelines?{' '}
            <Link href="/faq" className="text-primary-600 font-semibold hover:underline">
              Visit our FAQ
            </Link>{' '}
            or{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 font-semibold hover:underline">
              contact support
            </a>
            .
          </p>
        </div>
      </div>
    </AppShell>
  )
}
