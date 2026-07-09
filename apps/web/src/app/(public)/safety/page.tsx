import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import {
  safetyStandards,
  travelerEmergencySteps,
  safetyVerificationPoints,
  LAST_UPDATED as POLICY_DATES,
} from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Safety Standards | ${APP_NAME}`,
  description: `How ${APP_NAME} ensures your safety on group trips — vehicle standards, certified guides, first aid requirements, emergency protocols, and what to do in a safety emergency.`,
  alternates: { canonical: '/safety' },
  openGraph: {
    title: `Safety Standards | ${APP_NAME}`,
    description: `${APP_NAME}'s safety framework for group travel in India — what we require from organizers and how we protect travelers.`,
    type: 'website',
    url: '/safety',
  },
}

export default function SafetyPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Safety Standards', url: `${SITE_URL}/safety` },
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
            Safety Standards
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Last updated: {POLICY_DATES.safety}</p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            Every organizer on {APP_NAME} is contractually required to meet the safety standards on this page before and during every trip. Violations of these standards are grounds for immediate suspension under our Organizer Agreement.
          </p>
          <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
            {APP_NAME} is an intermediary marketplace and cannot physically verify compliance on every trip. Travelers should exercise their own judgement and report any safety concerns before or during a trip. See our <a href="/disclaimer" className="text-primary-600 hover:underline">Disclaimer</a> for the full scope of platform liability.
          </p>
        </div>

        {/* How we verify */}
        <div className="mb-10 rounded-2xl border border-primary-100 bg-primary-50 p-6">
          <h2 className="text-sm font-semibold text-primary-800 mb-2">How We Verify Organizer Safety</h2>
          <ul className="space-y-1.5 text-sm text-primary-700">
            {safetyVerificationPoints.map((point, i) => (
              <li key={i}>✓ {point}</li>
            ))}
          </ul>
        </div>

        {/* Safety standards */}
        <div className="space-y-10 mb-12">
          {safetyStandards.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{s.icon}</span>
                <h2 className="font-display text-xl font-bold text-neutral-800">{s.title}</h2>
              </div>
              <ul className="space-y-3">
                {s.items.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm text-neutral-600">
                    <span className="flex-shrink-0 mt-0.5 text-primary-500 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* What to do in emergency */}
        <section id="traveler-emergency" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            What to Do in a Safety Emergency (As a Traveler)
          </h2>
          <ol className="space-y-4">
            {travelerEmergencySteps.map((item, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{item.step}</p>
                  <p className="text-sm text-neutral-600 mt-0.5">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Report a safety concern */}
        <section id="report-safety" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            Report a Safety Concern
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            If an organizer violated safety standards during your trip — or if you observed unsafe practices before the trip — report it to us. Your report protects future travelers.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Safety Concern — Booking Reference`}
            className="btn-primary text-sm inline-block"
          >
            Report a Safety Issue
          </a>
          <p className="mt-3 text-xs text-neutral-400">
            All safety reports are reviewed within 24 hours. Organizer accounts are suspended immediately pending investigation for serious safety complaints.
          </p>
        </section>

        <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-6">
          <h2 className="font-semibold text-neutral-800 mb-3">Related Pages</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/rules" prefetch={false} className="text-sm text-primary-600 hover:underline">Rules &amp; Guidelines</Link>
            <Link href="/organizer-agreement" prefetch={false} className="text-sm text-primary-600 hover:underline">Organizer Agreement</Link>
            <Link href="/disclaimer" prefetch={false} className="text-sm text-primary-600 hover:underline">Disclaimer</Link>
            <Link href="/faq" prefetch={false} className="text-sm text-primary-600 hover:underline">FAQ</Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
