import { vi } from 'vitest'

// Mock environment variables for all tests
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.NODE_ENV = 'development'
process.env.CLIENT_URL = 'http://localhost:3000'

// Remove vars that may leak from .env and fail Zod validation in tests
delete process.env.REDIS_URL

// env.ts's RAZORPAYX_* superRefine gate now runs in every environment (H3 fix — see
// docs/codebase/Payments & Webhooks.md), not just production, because PAYOUT_STRATEGY
// defaults to 'razorpayx_payouts'. Set dummy values for the four RAZORPAYX_* vars
// (satisfying the gate) so the module-load-time `envSchema.parse(process.env)` in
// config/env.ts doesn't throw before a single test runs.
//
// PAYOUT_STRATEGY itself is left at its schema default ('razorpayx_payouts'). Individual
// test files that exercise the Route branch (auth.service.test.ts::connectBankAccount and
// organizer-lifecycle.test.ts) mutate `env.PAYOUT_STRATEGY` inside their describe blocks
// via beforeAll/afterAll. The prior "RazorpayX dual-write" suite was replaced on Jul 30
// with a "RazorpayX-exclusive" suite matching commit e2c8b4a's refactor.
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
