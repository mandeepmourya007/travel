import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { APP_NAME, SITE_URL } from '@/lib/constants'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_NAME} — Group Travel Aggregator`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    'Discover and book curated group trips. SafePay-protected payments, verified organizers, and hassle-free group travel from Pune.',
  keywords: [
    'group trips', 'group travel', 'weekend trips from Pune', 'adventure trips India',
    'trekking trips', 'beach trips Goa', 'Ladakh bike trip', 'SafePay payment travel',
    'verified trip organizers', 'compare group trips',
  ],
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
    description:
      'Discover curated group trips from verified organizers. SafePay-protected payments and real reviews.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
