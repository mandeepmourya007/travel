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
    default: `${APP_NAME} — India's Group Travel Aggregator`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    `${APP_NAME} is India's group travel aggregator — compare group trips from Pune, Mumbai, Delhi & Bangalore, book with SafePay-protected payments, and travel with verified organizers. Weekend getaways, treks, beach trips & adventure tours.`,
  keywords: [
    // Primary transactional
    'group trips India', 'group travel packages India', 'group tour packages',
    'weekend trips from Pune', 'weekend trips from Mumbai', 'weekend getaways from Bangalore',
    'weekend trips from Delhi',
    // Activity-based
    'group trekking India', 'group adventure trips', 'beach group trips Goa',
    'Ladakh group tour', 'Spiti Valley group trip', 'Manali group tour',
    // Platform-specific
    'book group trips online India', 'verified trip organizers India',
    'SafePay group travel', 'compare group trips India',
    // Trending niches
    'women only group tours India', 'solo traveller group trips India',
    'weekend group getaways India', 'budget group tours India',
    // Organizer-side
    'list group trips India', 'group travel organizer platform India',
  ],
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — Compare Group Trips. Book Safely.`,
    description:
      `India's group travel aggregator. Compare trips from verified organizers, book with SafePay protection, and travel with confidence. Weekend getaways, treks & adventure tours.`,
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
    other: {
      // Bing verification — critical for ChatGPT citations (ChatGPT uses Bing index)
      'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || undefined,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
