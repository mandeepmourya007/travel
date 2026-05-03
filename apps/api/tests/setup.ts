import { vi } from 'vitest'

// Mock environment variables for all tests
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'
process.env.NODE_ENV = 'test'
process.env.CLIENT_URL = 'http://localhost:3000'

// Remove vars that may leak from .env and fail Zod validation in tests
delete process.env.REDIS_URL

// Mock Pino logger globally
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}))
