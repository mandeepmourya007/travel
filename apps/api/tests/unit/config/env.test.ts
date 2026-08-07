import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * apps/api/src/config/env.ts parses process.env at module-load time (`envSchema.parse`),
 * throwing synchronously if invalid — so each scenario needs a fresh module instance
 * (vi.resetModules() + dynamic import) with process.env mutated beforehand. Baseline
 * required vars (JWT_SECRET, DATABASE_URL, NODE_ENV, RAZORPAYX_*) are set once for the
 * whole suite in tests/setup.ts.
 */
describe('env schema — HEALTH_CHECK_TOKEN', () => {
  const ORIGINAL_TOKEN = process.env.HEALTH_CHECK_TOKEN

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    if (ORIGINAL_TOKEN !== undefined) process.env.HEALTH_CHECK_TOKEN = ORIGINAL_TOKEN
    else delete process.env.HEALTH_CHECK_TOKEN
    vi.resetModules()
  })

  it('fails validation when HEALTH_CHECK_TOKEN is shorter than 32 characters', async () => {
    process.env.HEALTH_CHECK_TOKEN = 'a'.repeat(31)

    await expect(import('../../../src/config/env')).rejects.toThrow()
  })

  it('fails validation for a short, realistic guessable token', async () => {
    process.env.HEALTH_CHECK_TOKEN = 'letmein123'

    await expect(import('../../../src/config/env')).rejects.toThrow()
  })

  it('passes validation when HEALTH_CHECK_TOKEN is exactly 32 characters', async () => {
    const token = 'a'.repeat(32)
    process.env.HEALTH_CHECK_TOKEN = token

    const { env } = await import('../../../src/config/env')

    expect(env.HEALTH_CHECK_TOKEN).toBe(token)
  })

  it('passes validation when HEALTH_CHECK_TOKEN is longer than 32 characters', async () => {
    const token = 'a'.repeat(64)
    process.env.HEALTH_CHECK_TOKEN = token

    const { env } = await import('../../../src/config/env')

    expect(env.HEALTH_CHECK_TOKEN).toBe(token)
  })

  it('passes validation when HEALTH_CHECK_TOKEN is unset (optional — route stays inert)', async () => {
    delete process.env.HEALTH_CHECK_TOKEN

    const { env } = await import('../../../src/config/env')

    expect(env.HEALTH_CHECK_TOKEN).toBeUndefined()
  })
})
