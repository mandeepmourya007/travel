// ── Sentry — Browser / Client Config ─────────────────
// Runs in the user's browser.
// Captures:
//   • Unhandled JS errors and unhandled promise rejections
//   • Web-vitals (LCP, FCP, CLS, TTFB, INP) as performance spans
//   • Every fetch / XHR call (incl. axios API calls) — duration shown in trace
//   • Distributed traces: injects sentry-trace + baggage headers so FE and
//     BE transactions are linked into one FE→BE→DB waterfall in Sentry
// ─────────────────────────────────────────────────────
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Sample 20% of page-views/navigations for tracing.
    // Raise to 1.0 locally (NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=1) to test.
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) || 0.2,

    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Propagate Sentry trace headers to the API so FE and BE spans are linked.
    // Covers both the public API URL (browser) and localhost (dev).
    tracePropagationTargets: [
      'localhost',
      process.env.NEXT_PUBLIC_API_URL ?? '',
    ].filter(Boolean),
  })
}
