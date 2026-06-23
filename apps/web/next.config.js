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

// When SENTRY_AUTH_TOKEN is absent (Render free tier, CI without secrets),
// skip Sentry's webpack source-map plugin — it processes every JS chunk and
// is the main cause of OOM on memory-constrained builds (~500 MB extra heap).
// Runtime tracing and route instrumentation are unaffected; they're SDK-level.
const sentryBuildPluginEnabled = !!process.env.SENTRY_AUTH_TOKEN

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: {
    disable: !sentryBuildPluginEnabled,
  },
  tunnelRoute: '/monitoring',
  // Disable the webpack plugin when not uploading source maps — saves ~500MB
  // of peak heap during `next build` on memory-constrained build environments.
  disableClientWebpackPlugin: !sentryBuildPluginEnabled,
  disableServerWebpackPlugin: !sentryBuildPluginEnabled,
  webpack: {
    // Always instrument server functions — this wraps route handlers for tracing and
    // does NOT trigger source map processing (that's the webpack plugin above).
    autoInstrumentServerFunctions: true,
    treeshake: { removeDebugLogging: true },
  },
})
