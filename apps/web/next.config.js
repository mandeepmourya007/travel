const { IMAGE_HOSTS } = require('./src/config/image-hosts')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: false, // Nginx handles gzip in production — avoid double-compression overhead
  trailingSlash: false,
  transpilePackages: ['@travel/shared'],
  images: {
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
      ],
    },
  ],
}

// Wrap with Sentry to enable automatic source map upload and route-based
// transaction naming. When NEXT_PUBLIC_SENTRY_DSN is absent (e.g. in CI
// without secrets), the wrapper is a transparent pass-through.
module.exports = withSentryConfig(nextConfig, {
  // Suppress verbose Sentry build output
  silent: true,
  // Disable source-map upload unless SENTRY_AUTH_TOKEN is set (optional)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Avoids bundling Sentry's debug logger in the client bundle
  disableLogger: true,
  // Tunnel Sentry requests through /monitoring to avoid ad-blockers
  tunnelRoute: '/monitoring',
  // Automatically wrap route handlers and server components with Sentry
  autoInstrumentServerFunctions: true,
})
