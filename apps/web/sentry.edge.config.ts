// ── Sentry — Edge Runtime Config ─────────────────────
// Runs in Next.js Edge runtime (middleware, edge route handlers).
// Subset of the Node.js SDK — only error capture, no tracing integrations.
// ─────────────────────────────────────────────────────
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) || 0.2,
  })
}
