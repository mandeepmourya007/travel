import type { Metadata } from 'next'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME, SITE_URL, CONTACT_EMAIL } from '@/lib/constants'
import { buildBreadcrumbJsonLd } from '@/lib/structured-data'
import {
  essentialCookies,
  analyticsCookies,
  thirdPartyCookies,
  cookieDpdpaText,
  LAST_UPDATED as POLICY_DATES,
} from '@/lib/legal-content'

export const metadata: Metadata = {
  title: `Cookie Policy | ${APP_NAME}`,
  description: `Learn how ${APP_NAME} uses cookies and similar technologies. We only use essential and analytics cookies — no advertising trackers, no data sold to ad networks.`,
  alternates: { canonical: '/cookies' },
  openGraph: {
    title: `Cookie Policy | ${APP_NAME}`,
    description: `${APP_NAME}'s cookie usage — what we set, why, and how to manage them.`,
    type: 'website',
    url: '/cookies',
  },
}

export default function CookiePolicyPage() {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', url: SITE_URL },
    { name: 'Cookie Policy', url: `${SITE_URL}/cookies` },
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
            Cookie Policy
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Last updated: {POLICY_DATES.cookies}</p>
          <p className="mt-4 text-base text-neutral-600 leading-relaxed">
            This policy explains what cookies {APP_NAME} uses, why, and how you can control them. We keep cookie usage minimal — only what is necessary to run the platform and understand how it performs.
          </p>
        </div>

        {/* No ad trackers callout */}
        <div className="mb-10 rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="text-sm font-semibold text-green-800 mb-1">Our Cookie Commitment</p>
          <p className="text-sm text-green-700">
            We do not use advertising cookies, tracking pixels, or sell your browsing data to ad networks. The cookies we set are for keeping you logged in, saving your preferences, and understanding how the platform performs — nothing else.
          </p>
        </div>

        {/* Section 1 */}
        <section id="what-are-cookies" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-3">1. What Are Cookies?</h2>
          <p className="text-sm text-neutral-600">
            Cookies are small text files placed on your device by a website you visit. They allow the website to remember information about your visit — such as whether you're logged in or what you had in your comparison queue. Cookies cannot execute code or carry viruses.
          </p>
          <p className="mt-3 text-sm text-neutral-600">
            Similar technologies include local storage and session storage — browser-based mechanisms that store data on your device. We use these for the booking form (to save your form progress if you navigate away) and for the trip comparison queue.
          </p>
        </section>

        {/* Section 2 — Cookie tables */}
        <section id="cookies-we-use" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-5">2. Cookies We Use</h2>

          {/* Essential */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700">Essential</span>
              <p className="text-xs text-neutral-500">Cannot be disabled — required for the platform to function</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-neutral-200">
                    <th className="px-4 py-3 font-semibold text-neutral-700">Cookie / Storage</th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">Purpose</th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {essentialCookies.map((row) => (
                    <tr key={row.name}>
                      <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{row.name}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.purpose}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.expires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Analytics */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block rounded-full bg-primary-100 px-3 py-0.5 text-xs font-semibold text-primary-700">Analytics</span>
              <p className="text-xs text-neutral-500">Help us understand how the platform is used — anonymous and aggregated</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-neutral-200">
                    <th className="px-4 py-3 font-semibold text-neutral-700">Cookie / Storage</th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">Purpose</th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {analyticsCookies.map((row) => (
                    <tr key={row.name}>
                      <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{row.name}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.purpose}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.expires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Analytics data is aggregated. We cannot identify individual users from analytics data. No data is shared with advertising platforms.
            </p>
          </div>

          {/* Third-party */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block rounded-full bg-neutral-100 px-3 py-0.5 text-xs font-semibold text-neutral-600">Third-Party</span>
              <p className="text-xs text-neutral-500">Set by our payment partner during checkout</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-neutral-200">
                    <th className="px-4 py-3 font-semibold text-neutral-700">Provider</th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">Purpose</th>
                    <th className="px-4 py-3 font-semibold text-neutral-700">Their Policy</th>
                  </tr>
                </thead>
                <tbody>
                  {thirdPartyCookies.map((row) => (
                    <tr key={row.provider}>
                      <td className="px-4 py-3 text-neutral-600">{row.provider}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.purpose}</td>
                      <td className="px-4 py-3 text-neutral-600 text-xs">{row.policyUrl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Razorpay cookies are only set when the payment modal is open. They are governed by Razorpay's privacy policy, not ours.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section id="manage-cookies" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-3">3. How to Manage Cookies</h2>
          <p className="text-sm text-neutral-600 mb-4">
            You can control cookies through your browser settings. Most browsers allow you to view, delete, and block cookies from specific sites.
          </p>
          <ul className="space-y-2 text-sm text-neutral-600 list-disc list-inside mb-4">
            <li><span className="font-medium">Chrome:</span> Settings → Privacy and security → Cookies and other site data</li>
            <li><span className="font-medium">Safari:</span> Settings → Safari → Privacy &amp; Security</li>
            <li><span className="font-medium">Firefox:</span> Settings → Privacy &amp; Security → Cookies and Site Data</li>
          </ul>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">
              <span className="font-medium">Note:</span> Blocking essential cookies will prevent you from logging in and using booking features. Analytics cookies can be blocked without affecting platform functionality.
            </p>
          </div>
        </section>

        {/* Section 4 — DPDP Act */}
        <section id="dpdp-compliance" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-3">4. DPDP Act, 2023 Compliance</h2>
          <p className="text-sm text-neutral-600">{cookieDpdpaText.intro}</p>
          <p className="mt-3 text-sm text-neutral-600">The lawful basis for each category:</p>
          <ul className="mt-2 space-y-1 text-sm text-neutral-600 list-disc list-inside">
            {cookieDpdpaText.bases.map((b, i) => (
              <li key={i}><span className="font-medium">{b.label}:</span> {b.basis}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-neutral-600">
            {cookieDpdpaText.deletion.split(CONTACT_EMAIL)[0]}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 hover:underline">{CONTACT_EMAIL}</a>
            {cookieDpdpaText.deletion.split(CONTACT_EMAIL)[1]}
          </p>
        </section>

        {/* Section 5 */}
        <section id="changes" className="scroll-mt-20 mb-10">
          <h2 className="font-display text-xl font-bold text-neutral-800 mb-3">5. Changes to This Policy</h2>
          <p className="text-sm text-neutral-600">
            If we add new cookies or change how existing ones are used, we will update this policy and notify you via email or a banner on the platform. The "Last Updated" date at the top reflects the most recent change.
          </p>
        </section>

        <div className="rounded-2xl bg-primary-50 p-6">
          <p className="text-sm text-neutral-600">
            Cookie questions?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-600 font-semibold hover:underline">
              {CONTACT_EMAIL}
            </a>
            {' '}or read our full{' '}
            <Link href="/privacy" className="text-primary-600 font-semibold hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
