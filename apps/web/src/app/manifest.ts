import type { MetadataRoute } from 'next'
import { APP_NAME, SITE_URL } from '@/lib/constants'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — India's Group Travel Aggregator`,
    short_name: APP_NAME,
    description: 'Compare group trips from verified organizers. SafePay-protected payments. Weekend getaways, treks & adventure tours across India.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0FBAB5',
    orientation: 'portrait',
    scope: '/',
    lang: 'en-IN',
    categories: ['travel', 'lifestyle', 'shopping'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-home.png',
        sizes: '1280x720',
        type: 'image/png',
      },
    ],
  }
}
