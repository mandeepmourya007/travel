import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, COMPANY_ADDRESS } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import { contactChannels, responseTimeRows, responseTimeNote, LAST_UPDATED as POLICY_DATES } from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Contact Us | ${APP_NAME}`,
  description: `Get in touch with ${APP_NAME} — for booking support, refund queries, organizer inquiries, or grievance redressal. We're based in Pune and respond within 24–48 hours.`,
  alternates: { canonical: '/contact' },
  openGraph: {
    title: `Contact Us | ${APP_NAME}`,
    description: `Reach ${APP_NAME}'s support team for bookings, refunds, or grievance redressal.`,
    type: 'website',
    url: '/contact',
  },
}

export default function ContactPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Contact Us', url: `${SITE_URL}/contact` },
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
            Contact Us
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Last updated: {POLICY_DATES.contact}</p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            We're based in Pune and take every message seriously. Choose the right channel below to get the fastest response.
          </p>
        </div>

        {/* Support channels */}
        <div className="space-y-5 mb-12">
          {contactChannels.map((channel) => (
            <div key={channel.id} id={channel.id} className="rounded-2xl border border-neutral-200 bg-white p-6 scroll-mt-20">
              <div className="flex items-start gap-4">
                <span className="text-2xl flex-shrink-0">{channel.icon}</span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-lg font-bold text-neutral-800">
                    {channel.title}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">{channel.description}</p>
                  {channel.note && (
                    <p className="mt-2 text-xs text-neutral-400 italic">{channel.note}</p>
                  )}
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <a
                      href={`mailto:${channel.email}?subject=${encodeURIComponent(channel.subject)}`}
                      className="btn-primary text-sm inline-block text-center"
                    >
                      Email: {channel.email}
                    </a>
                    <span className="text-xs text-neutral-400">
                      {channel.responseTime}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Office info */}
        <section id="office" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">Office</h2>
          <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-6">
            <p className="text-sm font-semibold text-neutral-700">{APP_NAME}</p>
            <p className="mt-1 text-sm text-neutral-600">{COMPANY_ADDRESS}</p>
            <p className="mt-3 text-sm text-neutral-500">
              We are a remote-first team. Walk-in visits are not available — please use email for all queries.
            </p>
          </div>
        </section>

        {/* Response time policy */}
        <section id="response-times" className="scroll-mt-20 mb-12">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">Response Times</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="pb-3 pr-6 font-semibold text-neutral-700">Query Type</th>
                  <th className="pb-3 font-semibold text-neutral-700">Response Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {responseTimeRows.map((row) => (
                  <tr key={row.type}>
                    <td className="py-3 pr-6 text-neutral-600">{row.type}</td>
                    <td className="py-3 text-neutral-600">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-400">{responseTimeNote}</p>
        </section>

        {/* Tips for faster resolution */}
        <section id="faster-resolution" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-4">
            Get a Faster Response
          </h2>
          <ul className="space-y-2 text-sm text-neutral-600 list-disc list-inside">
            <li>Always include your <span className="font-medium">booking reference number</span> in the subject line.</li>
            <li>For refund queries, mention the <span className="font-medium">original payment method</span> (UPI/card/net banking) and transaction date.</li>
            <li>For organizer issues, include the <span className="font-medium">trip name, slug, or organizer username</span>.</li>
            <li>For safety complaints, describe the incident with <span className="font-medium">date, location, and the organizer's name</span>.</li>
            <li>For data privacy requests, use the subject line <span className="font-medium">"Data Rights Request"</span> and specify what action you want (access/correction/deletion).</li>
          </ul>
        </section>

        {/* Quick links */}
        <div className="rounded-2xl bg-primary-50 p-6">
          <h2 className="font-semibold text-neutral-800 mb-3">Before you email — check these first</h2>
          <div className="flex flex-wrap gap-3">
            {[
              { href: '/faq', label: 'FAQ' },
              { href: '/cancellation-policy', label: 'Cancellation Policy' },
              { href: '/rules', label: 'Rules & Guidelines' },
              { href: '/lost-item', label: 'Lost Item Policy' },
              { href: '/privacy', label: 'Privacy Policy' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                prefetch={false}
                className="rounded-lg border border-primary-200 bg-white px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
