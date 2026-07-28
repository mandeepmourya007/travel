import { vi } from 'vitest'

// Mock environment variables for all tests
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.NODE_ENV = 'test'
process.env.CLIENT_URL = 'http://localhost:3000'

// Remove vars that may leak from .env and fail Zod validation in tests
delete process.env.REDIS_URL

// env.ts's RAZORPAYX_* superRefine gate now runs in every environment (H3 fix — see
// docs/codebase/Payments & Webhooks.md), not just production, because PAYOUT_STRATEGY
// defaults to 'razorpayx_payouts'. Several existing tests (e.g. auth.service.test.ts's
// "RazorpayX dual-write" suite) deliberately rely on env.PAYOUT_STRATEGY defaulting to
// 'razorpayx_payouts' — so rather than overriding PAYOUT_STRATEGY itself, set dummy
// values for the four RAZORPAYX_* vars (satisfying the gate) so the module-load-time
// `envSchema.parse(process.env)` in config/env.ts doesn't throw before a single test
// runs, while preserving the schema default every existing test already assumes.
process.env.RAZORPAYX_KEY_ID = process.env.RAZORPAYX_KEY_ID || 'rzp_test_dummy_key_id'
process.env.RAZORPAYX_KEY_SECRET = process.env.RAZORPAYX_KEY_SECRET || 'dummy_key_secret'
process.env.RAZORPAYX_ACCOUNT_NUMBER = process.env.RAZORPAYX_ACCOUNT_NUMBER || '0000000000000000'
process.env.RAZORPAYX_WEBHOOK_SECRET = process.env.RAZORPAYX_WEBHOOK_SECRET || 'dummy_webhook_secret'

// ── Mock logger (base + request-aware) ───────────────
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
}

vi.mock('../src/utils/logger', () => ({
  logger: mockLogger,
  getLogger: vi.fn().mockReturnValue(mockLogger),
}))

vi.mock('../src/utils/request-context', () => ({
  requestContext: { getStore: vi.fn(), run: vi.fn() },
  getRequestLogger: vi.fn(),
  getRequestContext: vi.fn().mockReturnValue({}),
}))
