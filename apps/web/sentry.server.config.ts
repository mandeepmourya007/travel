// ── Sentry — Server / Node.js Config ─────────────────
// Runs on the Next.js Node.js runtime (Server Components, Route Handlers,
// Server Actions, Middleware when using the Node runtime).
// Captures SSR errors and outgoing server-side fetch durations.
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
