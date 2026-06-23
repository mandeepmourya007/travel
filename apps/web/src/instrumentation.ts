// ── Next.js Instrumentation Hook ─────────────────────
// Next.js 14 loads this file once at server startup (Node & Edge).
// It registers the Sentry server/edge configs so error and trace
// capture is active for all Server Components and Route Handlers.
// ─────────────────────────────────────────────────────
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
