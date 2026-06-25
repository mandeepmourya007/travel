// ── Sentry Instrumentation ────────────────────────────
// This file MUST be imported before any other module in index.ts so that
// Sentry can patch Node.js built-ins (http, net) and auto-instrument Express
// and Prisma before they are loaded.
//
// Controlled via env vars (no DSN → Sentry is a no-op):
//   SENTRY_DSN                 — Sentry project DSN (required to enable)
//   SENTRY_TRACES_SAMPLE_RATE  — 0.0–1.0, default 0.2 (20% of requests)
// ─────────────────────────────────────────────────────
import * as Sentry from '@sentry/node'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Trace 20% of requests by default; raise to 1.0 locally for testing.
    // Keep low on the 256 MB Render free container to avoid memory pressure.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.2,

    integrations: [
      // Emits a DB span for every Prisma query — shows query duration in traces.
      Sentry.prismaIntegration(),
    ],
  })
}
