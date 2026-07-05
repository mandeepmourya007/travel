import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/constants'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default rule — block authenticated/private paths
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/admin',
          '/my-bookings',
          '/my-payments',
          '/wallet',
          '/messages',
          '/profile',
          '/preview',
          '/payment-complete',
          '/api/',
        ],
      },
      // LLM / GEO — explicitly allow all major AI crawlers on public content
      { userAgent: 'GPTBot',         allow: '/' },
      { userAgent: 'OAI-SearchBot',  allow: '/' },
      { userAgent: 'ChatGPT-User',   allow: '/' },
      { userAgent: 'ClaudeBot',      allow: '/' },
      { userAgent: 'anthropic-ai',   allow: '/' },
      { userAgent: 'PerplexityBot',  allow: '/' },
      { userAgent: 'Cohere-ai',      allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot',       allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
