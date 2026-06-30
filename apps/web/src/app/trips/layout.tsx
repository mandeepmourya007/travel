import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Explore Group Trips from Pune | ${APP_NAME}`,
  description:
    'Compare and book curated group trips from Pune. Weekend getaways, treks, beach trips, and adventure tours with verified organizers. SafePay-protected payments.',
  alternates: {
    canonical: '/trips',
  },
  openGraph: {
    title: `Explore Group Trips from Pune | ${APP_NAME}`,
    description:
      'Compare and book curated group trips from Pune. Weekend getaways, treks, beach trips, and adventure tours with verified organizers.',
    type: 'website',
    url: '/trips',
  },
}

export default function TripsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
