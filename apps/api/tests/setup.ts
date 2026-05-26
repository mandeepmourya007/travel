import { vi } from 'vitest'

// Mock environment variables for all tests
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.NODE_ENV = 'test'
process.env.CLIENT_URL = 'http://localhost:3000'

// Remove vars that may leak from .env and fail Zod validation in tests
delete process.env.REDIS_URL

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
