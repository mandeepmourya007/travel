import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import {
  cancellationTiers,
  cancellationTimezoneNote,
  organizerCancellationText,
  platformCancellationReasons,
  howToCancelSteps,
  refundTimelines,
  refundTimelineNote,
  nonRefundableReasons,
  partialCancellationText,
  forceMajeureText,
  LAST_UPDATED as POLICY_DATES,
} from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Cancellation & Refund Policy | ${APP_NAME}`,
  description: `Understand ${APP_NAME}'s cancellation and refund rules — Flexible, Moderate, and Strict policies for group trips, organizer cancellations, and how escrow refunds work.`,
  alternates: { canonical: '/cancellation-policy' },
  openGraph: {
    title: `Cancellation & Refund Policy | ${APP_NAME}`,
    description: `Clear refund rules for travelers and organizers on ${APP_NAME}. Escrow-protected refunds processed via Razorpay.`,
    type: 'website',
    url: '/cancellation-policy',
  },
}

const tierBadgeClasses: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
}

export default function CancellationPolicyPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Cancellation Policy', url: `${SITE_URL}/cancellation-policy` },
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
            Cancellation &amp; Refund Policy
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Last updated: {POLICY_DATES.cancellation}</p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            All payments on {APP_NAME} are held in escrow via Razorpay, which means your money is protected until the trip is completed. This policy explains exactly when and how refunds are issued.
          </p>
        </div>

        {/* Escrow callout */}
        <div className="mb-10 rounded-2xl border border-green-100 bg-green-50 p-5">
          <h2 className="text-sm font-semibold text-green-800 mb-1">Escrow Protection</h2>
          <p className="text-sm text-green-700">
            Your payment is never released to the organizer until the trip is completed. {organizerCancellationText.escrowCallout}
          </p>
        </div>

        {/* Section 1: Traveler Cancellations */}
        <section id="traveler-cancellation" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-6">
            1. If You (Traveler) Cancel
          </h2>
          <p className="text-sm text-neutral-600 mb-6">
            Each trip has one of three cancellation policies chosen by the organizer. The policy is clearly displayed on the trip page and booking confirmation. Please check before booking.
          </p>

          <div className="space-y-4">
            {cancellationTiers.map((tier) => (
              <div key={tier.id} className="rounded-2xl border border-neutral-200 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${tierBadgeClasses[tier.color]}`}>
                    {tier.label}
                  </span>
                </div>
                <ul className="space-y-2 text-sm text-neutral-600">
                  {tier.rules.map((rule, i) => (
                    <li key={i}>
                      <span className="font-medium text-neutral-800">{rule.timing}:</span>{' '}
                      {rule.refund}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-neutral-500">* {cancellationTimezoneNote}</p>
        </section>

        {/* Section 2: Organizer Cancellations */}
        <section id="organizer-cancellation" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            2. If the Organizer Cancels
          </h2>
          <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
            <p className="text-sm text-green-800 font-medium">{organizerCancellationText.heading}</p>
            <p className="mt-1 text-sm text-green-700">{organizerCancellationText.body}</p>
          </div>
          <p className="mt-4 text-sm text-neutral-600">{organizerCancellationText.penaltyNote}</p>
        </section>

        {/* Section 3: Platform Cancellations */}
        <section id="platform-cancellation" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            3. Platform-Initiated Cancellations
          </h2>
          <p className="text-sm text-neutral-600">
            {APP_NAME} may cancel a booking or a trip listing in the following circumstances:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-600 list-disc list-inside">
            {platformCancellationReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-neutral-600">
            In all platform-initiated cancellations, affected travelers receive a full refund.
          </p>
        </section>

        {/* Section 4: How to Cancel */}
        <section id="how-to-cancel" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            4. How to Cancel Your Booking
          </h2>
          <ol className="space-y-3 text-sm text-neutral-600">
            {howToCancelSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 font-semibold text-primary-600">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Section 5: Refund Timeline */}
        <section id="refund-timeline" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            5. Refund Timeline
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="pb-3 pr-6 font-semibold text-neutral-700">Payment Method</th>
                  <th className="pb-3 font-semibold text-neutral-700">Refund Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {refundTimelines.map((row) => (
                  <tr key={row.method}>
                    <td className="py-3 pr-6 text-neutral-600">{row.method}</td>
                    <td className="py-3 text-neutral-600">{row.timeline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-400">{refundTimelineNote}</p>
        </section>

        {/* Section 6: Non-Refundable Scenarios */}
        <section id="non-refundable" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            6. Non-Refundable Scenarios
          </h2>
          <p className="text-sm text-neutral-600 mb-3">No refund will be issued in the following situations:</p>
          <ul className="space-y-2 text-sm text-neutral-600 list-disc list-inside">
            {nonRefundableReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </section>

        {/* Section 7: Partial Group Cancellations */}
        <section id="partial-cancellations" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            7. Partial Group Cancellations
          </h2>
          <p className="text-sm text-neutral-600">{partialCancellationText}</p>
        </section>

        {/* Section 8: Force Majeure */}
        <section id="force-majeure" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            8. Force Majeure
          </h2>
          <p className="text-sm text-neutral-600">{forceMajeureText.main}</p>
          <p className="mt-3 text-sm text-neutral-600">{forceMajeureText.liability}</p>
        </section>

        {/* Contact */}
        <div className="mt-4 rounded-2xl bg-primary-50 p-6">
          <h2 className="font-semibold text-neutral-800 mb-2">Refund not received?</h2>
          <p className="text-sm text-neutral-600">
            If your refund hasn't appeared within the stated timeline, email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 font-semibold hover:underline">
              {CONTACT_EMAIL}
            </a>{' '}
            with your booking reference number. We'll investigate and resolve it within 48 hours.
          </p>
          <div className="mt-4">
            <Link href="/faq" className="text-sm text-primary-600 font-medium hover:underline">
              View Cancellation FAQs →
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
