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
    'Discover and book curated group trips. Escrow-protected payments, verified organizers, and hassle-free group travel from Pune.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning>
        {/* Pre-hydration loader — shows instantly before React/JS loads.
            Removed by Providers useEffect once the app mounts. */}
        <div
          id="__initial-loader"
          suppressHydrationWarning
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(250, 250, 250, 0.95)',
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes __spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
            #__initial-spinner {
              width: 48px;
              height: 48px;
              border: 4px solid #e0f2f1;
              border-top-color: #0fbab5;
              border-radius: 50%;
              animation: __spin 0.8s linear infinite;
            }
          `}} />
          <div id="__initial-spinner" />
        </div>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
