const { IMAGE_HOSTS } = require('./src/config/image-hosts')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true, // Compress at the app layer — required on Render (no proxy in front);
  // on the Nginx path it passes through already-gzipped responses (no double-compression).
  trailingSlash: false,
  transpilePackages: ['@travel/shared'],
  // Lint runs as a separate turbo task — skip it during `next build` to avoid
  // ESLint version mismatches between the build environment and the lint config.
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Custom loader — serve images straight from the Cloudinary/Unsplash CDN with
    // CDN-side transforms (f_auto/q_auto/resize), bypassing Next's server-side
    // `sharp` optimizer. This removes the per-image cold-optimization latency
    // (3-6s on Render free) and offloads delivery to a global CDN.
    // NOTE: with a custom loader, `formats` and `minimumCacheTTL` no longer apply
    // (Next isn't serving the bytes). `remotePatterns` still restricts which
    // domains are allowed in <Image src> props — keep it as the whitelist.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  // ── API reverse proxy ───────────────────────────────────────────────────────
  // When BACKEND_API_URL is set (Render cloud: FE and BE are on separate services),
  // Next.js acts as a transparent proxy: browser requests to /api/* are forwarded
  // server-side to the actual API host. This keeps everything under the same domain
  // (safarnama.store) so the HttpOnly refresh-token cookie is always same-site — no
  // SameSite=None or cross-origin workarounds needed.
  //
  // In Docker (VPS + Nginx) or local dev, BACKEND_API_URL is not set — Nginx / the
  // local dev server already routes /api/* to the backend, so no rewrite is needed.
  rewrites: async () => {
    const backend = process.env.BACKEND_API_URL
    if (!backend) return []
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ]
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
