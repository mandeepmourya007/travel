import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { AuthService } from '../../../src/services/auth.service'
import { AuthError, ConflictError } from '../../../src/errors/app-error'

// ── Test doubles ──────────────────────────────────────

function createMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByGoogleId: vi.fn(),
    create: vi.fn(),
    updatePassword: vi.fn(),
    emailExists: vi.fn(),
  }
}

function createMockRefreshTokenRepo() {
  return {
    create: vi.fn(),
    findByHash: vi.fn(),
    revokeByHash: vi.fn(),
    revokeAllForUser: vi.fn(),
    deleteExpired: vi.fn(),
  }
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as import('pino').Logger

function createMockOrganizerProfileRepo() {
  return {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    incrementTripCount: vi.fn(),
  }
}

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'

const testUser = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'TRAVELER' as const,
  isActive: true,
  avatarUrl: null,
  passwordHash: '$2b$12$hashedpassword',
}

const meta = { userAgent: 'test-agent', ip: '127.0.0.1' }

// ── Tests ─────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService
  let userRepo: ReturnType<typeof createMockUserRepo>
  let refreshTokenRepo: ReturnType<typeof createMockRefreshTokenRepo>
  let organizerProfileRepo: ReturnType<typeof createMockOrganizerProfileRepo>

  beforeEach(() => {
    vi.clearAllMocks()
    userRepo = createMockUserRepo()
    refreshTokenRepo = createMockRefreshTokenRepo()
    organizerProfileRepo = createMockOrganizerProfileRepo()
    service = new AuthService(
      userRepo as any,
      refreshTokenRepo as any,
      organizerProfileRepo as any,
      JWT_SECRET,
      mockLogger,
    )
  })

  // ── signup ────────────────────────────────────────

  describe('signup', () => {
    const signupDto = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password1',
      role: 'TRAVELER' as const,
    }

    it('creates user and returns auth response', async () => {
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(testUser)
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.signup(signupDto, meta)

      expect(userRepo.emailExists).toHaveBeenCalledWith('john@example.com')
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          role: 'TRAVELER',
        }),
      )
      expect(result.auth.user.id).toBe('user-123')
      expect(result.auth.user.email).toBe('john@example.com')
      expect(result.auth.tokens.accessToken).toBeDefined()
      expect(result.auth.tokens.expiresIn).toBe(900)
      expect(result.refreshToken).toBeDefined()
    })

    it('hashes password before storing', async () => {
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(testUser)
      refreshTokenRepo.create.mockResolvedValue({})

      await service.signup(signupDto, meta)

      const createCall = userRepo.create.mock.calls[0][0]
      expect(createCall.passwordHash).not.toBe('Password1')
      expect(createCall.passwordHash).toMatch(/^\$2[aby]\$/)
    })

    it('throws ConflictError if email exists', async () => {
      userRepo.emailExists.mockResolvedValue(true)

      await expect(service.signup(signupDto, meta)).rejects.toThrow(ConflictError)
      expect(userRepo.create).not.toHaveBeenCalled()
    })

    it('stores refresh token hash (not raw)', async () => {
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(testUser)
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.signup(signupDto, meta)

      const createCall = refreshTokenRepo.create.mock.calls[0][0]
      expect(createCall.tokenHash).not.toBe(result.refreshToken)
      expect(createCall.tokenHash).toHaveLength(64) // SHA-256 hex
    })

    it('generates valid JWT access token', async () => {
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(testUser)
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.signup(signupDto, meta)

      const decoded = jwt.verify(result.auth.tokens.accessToken, JWT_SECRET) as any
      expect(decoded.userId).toBe('user-123')
      expect(decoded.role).toBe('TRAVELER')
    })
  })

  // ── login ─────────────────────────────────────────

  describe('login', () => {
    const loginDto = { email: 'john@example.com', password: 'Password1' }

    it('returns auth response on valid credentials', async () => {
      const hashed = await bcrypt.hash('Password1', 4)
      userRepo.findByEmail.mockResolvedValue({ ...testUser, passwordHash: hashed })
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.login(loginDto, meta)

      expect(result.auth.user.email).toBe('john@example.com')
      expect(result.auth.tokens.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it('throws AuthError on wrong email', async () => {
      userRepo.findByEmail.mockResolvedValue(null)

      await expect(service.login(loginDto, meta)).rejects.toThrow(AuthError)
    })

    it('throws AuthError on wrong password', async () => {
      const hashed = await bcrypt.hash('DifferentPassword1', 4)
      userRepo.findByEmail.mockResolvedValue({ ...testUser, passwordHash: hashed })

      await expect(service.login(loginDto, meta)).rejects.toThrow(AuthError)
    })

    it('throws AuthError if account is deactivated', async () => {
      const hashed = await bcrypt.hash('Password1', 4)
      userRepo.findByEmail.mockResolvedValue({ ...testUser, passwordHash: hashed, isActive: false })

      await expect(service.login(loginDto, meta)).rejects.toThrow(AuthError)
    })
  })

  // ── refresh ───────────────────────────────────────

  describe('refresh', () => {
    it('returns new access token for valid refresh token', async () => {
      const crypto = await import('crypto')
      const rawToken = crypto.randomBytes(64).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

      refreshTokenRepo.findByHash.mockResolvedValue({
        tokenHash,
        userId: 'user-123',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      })
      userRepo.findById.mockResolvedValue(testUser)

      const result = await service.refresh(rawToken)

      expect(result.accessToken).toBeDefined()
      expect(result.expiresIn).toBe(900)
    })

    it('throws AuthError for invalid token', async () => {
      refreshTokenRepo.findByHash.mockResolvedValue(null)

      await expect(service.refresh('invalid-token')).rejects.toThrow(AuthError)
    })

    it('throws AuthError for revoked token', async () => {
      refreshTokenRepo.findByHash.mockResolvedValue({
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      })

      await expect(service.refresh('some-token')).rejects.toThrow(AuthError)
    })

    it('throws AuthError for expired token', async () => {
      refreshTokenRepo.findByHash.mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      })

      await expect(service.refresh('some-token')).rejects.toThrow(AuthError)
    })
  })

  // ── logout ────────────────────────────────────────

  describe('logout', () => {
    it('revokes the refresh token', async () => {
      refreshTokenRepo.revokeByHash.mockResolvedValue({})

      await service.logout('raw-token')

      expect(refreshTokenRepo.revokeByHash).toHaveBeenCalled()
    })

    it('does not throw if token does not exist', async () => {
      refreshTokenRepo.revokeByHash.mockRejectedValue(new Error('Not found'))

      await expect(service.logout('nonexistent')).resolves.toBeUndefined()
    })
  })

  // ── logoutAll ─────────────────────────────────────

  describe('logoutAll', () => {
    it('revokes all tokens for user', async () => {
      refreshTokenRepo.revokeAllForUser.mockResolvedValue({ count: 3 })

      await service.logoutAll('user-123')

      expect(refreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-123')
    })
  })

  // ── getMe ─────────────────────────────────────────

  describe('getMe', () => {
    it('returns user profile', async () => {
      userRepo.findById.mockResolvedValue(testUser)

      const result = await service.getMe('user-123')

      expect(result.id).toBe('user-123')
      expect(result.email).toBe('john@example.com')
      expect(result.role).toBe('TRAVELER')
    })

    it('throws AuthError if user not found', async () => {
      userRepo.findById.mockResolvedValue(null)

      await expect(service.getMe('nonexistent')).rejects.toThrow(AuthError)
    })
  })

  // ── verifyAccessToken ─────────────────────────────

  describe('verifyAccessToken', () => {
    it('returns payload for valid token', () => {
      const token = jwt.sign({ userId: 'u1', role: 'TRAVELER' }, JWT_SECRET, { expiresIn: '15m' })

      const payload = service.verifyAccessToken(token)

      expect(payload.userId).toBe('u1')
      expect(payload.role).toBe('TRAVELER')
    })

    it('throws AuthError for expired token', () => {
      const token = jwt.sign({ userId: 'u1', role: 'TRAVELER' }, JWT_SECRET, { expiresIn: '0s' })

      expect(() => service.verifyAccessToken(token)).toThrow(AuthError)
    })

    it('throws AuthError for invalid token', () => {
      expect(() => service.verifyAccessToken('garbage')).toThrow(AuthError)
    })

    it('throws AuthError for wrong secret', () => {
      const token = jwt.sign({ userId: 'u1', role: 'TRAVELER' }, 'wrong-secret')

      expect(() => service.verifyAccessToken(token)).toThrow(AuthError)
    })
  })
})
