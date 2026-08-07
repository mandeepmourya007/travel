import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createHealthReadyRoutes } from '../../src/routes/health.routes'
import { HealthController } from '../../src/controllers/health.controller'
import { errorHandler } from '../../src/middleware/error-handler.middleware'
import { env } from '../../src/config/env'

/**
 * Real end-to-end HTTP wiring for GET /api/v1/health/ready — guard order
 * (healthReadyRateLimit before requireHealthToken), status codes, and response shape —
 * via Supertest against the actual createHealthReadyRoutes() router, matching the
 * tests/integration/auth.routes.test.ts pattern.
 *
 * The 5 req/60s rate-limit *counting* logic itself is covered separately (fast,
 * sub-millisecond, direct middleware invocation, no real HTTP) in
 * tests/unit/middleware/rate-limit.middleware.test.ts — see the comment there: importing
 * this route module was found to add a large, unexplained fixed latency (~150-200ms) to
 * the first awaited call made afterwards in a test file (reproducible in isolation, not
 * root-caused — it doesn't reproduce with a hand-built equivalent Router+middleware
 * chain, only with this exact module). All assertions below are folded into a single
 * `it()` firing one concurrent batch of requests, so that cost is paid once for the
 * whole file rather than once per request or per test.
 */
const TEST_TOKEN = 'a'.repeat(32)
const ORIGINAL_TOKEN = env.HEALTH_CHECK_TOKEN

function createTestApp() {
  const fakeHealthService = {
    getReadiness: vi.fn().mockResolvedValue({
      status: 'healthy',
      checks: { cloudinary: 'up', paymentGateway: 'up', resend: 'up', msg91: 'up' },
      detail: {},
      notes: [],
      timestamp: new Date().toISOString(),
    }),
  }
  const controller = new HealthController(fakeHealthService as any)
  const app = express()
  // Distinct X-Forwarded-For per scenario below keeps each one's rate-limit bucket
  // independent within the single shared healthReadyRateLimit singleton.
  app.set('trust proxy', true)
  app.use('/api/v1/health', createHealthReadyRoutes(controller))
  app.use(errorHandler)
  return app
}

describe('GET /api/v1/health/ready (integration)', () => {
  beforeAll(() => {
    ;(env as { HEALTH_CHECK_TOKEN?: string }).HEALTH_CHECK_TOKEN = TEST_TOKEN
  })

  afterAll(() => {
    ;(env as { HEALTH_CHECK_TOKEN?: string }).HEALTH_CHECK_TOKEN = ORIGINAL_TOKEN
  })

  it('wires the rate limiter and token guard correctly end-to-end', async () => {
    const app = createTestApp()
    const rateLimitIp = '198.51.100.1'

    const get = (headers: Record<string, string>) => {
      let req = request(app).get('/api/v1/health/ready')
      for (const [key, value] of Object.entries(headers)) req = req.set(key, value)
      return req
    }

    // The 5-then-429 rate-limit sequence must stay sequential-ish (5 in flight, THEN the
    // 6th) to deterministically exhaust `rateLimitIp`'s bucket before the 6th is sent.
    // The three token-guard scenarios use their own distinct identifiers, so they're
    // safe to run concurrently alongside it in the same batch — that's what keeps the
    // whole file down to a single paid instance of the fixed per-file latency described
    // above, instead of one per `it()`.
    const rateLimitSequence = Promise.all(
      Array.from({ length: 5 }, () => get({ 'x-health-token': TEST_TOKEN, 'X-Forwarded-For': rateLimitIp })),
    ).then(async (firstFive) => ({
      firstFive,
      sixth: await get({ 'x-health-token': TEST_TOKEN, 'X-Forwarded-For': rateLimitIp }),
    }))

    const [{ firstFive, sixth }, missingToken, wrongToken, validToken] = await Promise.all([
      rateLimitSequence,
      get({ 'X-Forwarded-For': '198.51.100.2' }),
      get({ 'x-health-token': 'wrong-token', 'X-Forwarded-For': '198.51.100.3' }),
      get({ 'x-health-token': TEST_TOKEN, 'X-Forwarded-For': '198.51.100.4' }),
    ])

    expect(firstFive.every((res) => res.status === 200)).toBe(true)

    expect(sixth.status).toBe(429)
    expect(sixth.body).toEqual({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
    })

    expect(missingToken.status).toBe(404)
    expect(wrongToken.status).toBe(404)

    expect(validToken.status).toBe(200)
    expect(validToken.body.status).toBe('healthy')
  })
})
