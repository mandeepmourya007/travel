import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Group Travel Packages India — Trips from Pune, Mumbai & Delhi | ${APP_NAME}`,
  // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
  // Original: `Browse 75+ group travel packages across India. Weekend trips from Pune (Lonavala, Mahabaleshwar, Goa), Mumbai, Delhi & Bangalore. Treks to Ladakh, Spiti Valley, Manali & Rishikesh. SafePay-protected payments, verified organizers, real reviews.`
  description:
    `Browse 75+ group travel packages across India. Weekend trips from Pune (Lonavala, Mahabaleshwar, Goa), Mumbai, Delhi & Bangalore. Treks to Ladakh, Spiti Valley, Manali & Rishikesh. Secure payments, verified organizers, real reviews.`,
  alternates: {
    canonical: '/trips',
  },
  openGraph: {
    title: `Group Travel Packages India | Weekend Trips & Adventure Tours | ${APP_NAME}`,
    // Commented out — restore if SafePay escrow-hold-until-trip-done is accurately implemented for all payment providers.
    // Original: `75+ group trip packages across India — Goa, Manali, Ladakh, Rishikesh & more. Weekend getaways from Pune, Mumbai, Delhi & Bangalore. Book safely with SafePay.`
    description:
      `75+ group trip packages across India — Goa, Manali, Ladakh, Rishikesh & more. Weekend getaways from Pune, Mumbai, Delhi & Bangalore. Book safely with secure payments.`,
    type: 'website',
    url: '/trips',
    locale: 'en_IN',
  },
}

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
