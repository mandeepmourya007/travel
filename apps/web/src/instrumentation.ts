// ── Next.js Instrumentation Hook ─────────────────────
// Next.js 15 loads this file once at server startup (Node & Edge).
// It registers the Sentry server/edge configs so error and trace
// capture is active for all Server Components and Route Handlers.
// ─────────────────────────────────────────────────────
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Captures errors thrown by Server Components, middleware, and Route Handlers.
// Requires Next.js 15+ and @sentry/nextjs >= 8.28.0.
export const onRequestError = Sentry.captureRequestError
