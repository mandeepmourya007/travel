import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * Pre-existing gap fixed in passing: `/reseller/**` had no layout at all, so
 * none of these pages ever rendered the header/footer/nav (the conditional
 * "Reseller" nav link in `header.tsx` led to a chrome-less page with no way
 * back except the browser's back button). Matches the same pattern as the
 * sibling traveler routes (`wallet/layout.tsx`, `my-bookings/layout.tsx`, …).
 */
export default function ResellerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
