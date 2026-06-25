import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { AuthService } from '../../../src/services/auth.service'
import { AuthError, ConflictError, NotFoundError } from '../../../src/errors/app-error'

// ── Test doubles ──────────────────────────────────────

function createMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByGoogleId: vi.fn(),
    create: vi.fn(),
    updatePassword: vi.fn(),
    updateProfile: vi.fn(),
    updateGoogleId: vi.fn(),
    emailExists: vi.fn(),
    findWithOrganizer: vi.fn(),
  }
}

function createMockRefreshTokenRepo() {
  return {
    create: vi.fn(),
    findByHash: vi.fn(),
    revokeByHash: vi.fn(),
    revokeByFamily: vi.fn(),
    revokeAllForUser: vi.fn(),
    deleteExpired: vi.fn(),
  }
}

function createMockLoginAttemptTracker() {
  return {
    isLocked: vi.fn().mockResolvedValue(0),
    recordFailure: vi.fn().mockResolvedValue({ locked: false, remainingAttempts: 4 }),
    resetAttempts: vi.fn().mockResolvedValue(undefined),
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
    slugExists: vi.fn().mockResolvedValue(false),
  }
}

function createMockWalletRepo() {
  return {
    create: vi.fn(),
    findByUserId: vi.fn(),
    findOrCreate: vi.fn(),
  }
}

function createMockDocReviewRepo() {
  return {
    upsert: vi.fn(),
    upsertMany: vi.fn(),
    countApproved: vi.fn(),
    findComments: vi.fn(),
    addComment: vi.fn(),
    updateAllDocStatuses: vi.fn(),
    findByOrganizerId: vi.fn(),
  }
}

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'

const testUser = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com' as string | null,
  role: 'TRAVELER' as const,
  isActive: true,
  avatarUrl: null,
  passwordHash: '$2b$12$hashedpassword',
  googleId: null as string | null,
  phone: null as string | null,
  phoneVerified: false,
}

const meta = { userAgent: 'test-agent', ip: '127.0.0.1' }

// ── Tests ─────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService
  let userRepo: ReturnType<typeof createMockUserRepo>
  let refreshTokenRepo: ReturnType<typeof createMockRefreshTokenRepo>
  let organizerProfileRepo: ReturnType<typeof createMockOrganizerProfileRepo>
  let walletRepo: ReturnType<typeof createMockWalletRepo>
  let docReviewRepo: ReturnType<typeof createMockDocReviewRepo>

  let loginAttemptTracker: ReturnType<typeof createMockLoginAttemptTracker>

  beforeEach(() => {
    vi.clearAllMocks()
    userRepo = createMockUserRepo()
    refreshTokenRepo = createMockRefreshTokenRepo()
    organizerProfileRepo = createMockOrganizerProfileRepo()
    walletRepo = createMockWalletRepo()
    docReviewRepo = createMockDocReviewRepo()
    loginAttemptTracker = createMockLoginAttemptTracker()
    service = new AuthService(
      userRepo as any,
      refreshTokenRepo as any,
      organizerProfileRepo as any,
      walletRepo as any,
      JWT_SECRET,
      mockLogger,
      'test-google-client-id',
      loginAttemptTracker as any,
      docReviewRepo as any,
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

    it('records failure and throws when email does not exist', async () => {
      userRepo.findByEmail.mockResolvedValue(null)

      await expect(service.login(loginDto, meta)).rejects.toThrow(AuthError)
      expect(loginAttemptTracker.recordFailure).toHaveBeenCalledWith('john@example.com')
    })

    it('records failure on wrong password', async () => {
      const hashed = await bcrypt.hash('DifferentPassword1', 4)
      userRepo.findByEmail.mockResolvedValue({ ...testUser, passwordHash: hashed })

      await expect(service.login(loginDto, meta)).rejects.toThrow(AuthError)
      expect(loginAttemptTracker.recordFailure).toHaveBeenCalledWith('john@example.com')
    })

    it('resets attempts on successful login', async () => {
      const hashed = await bcrypt.hash('Password1', 4)
      userRepo.findByEmail.mockResolvedValue({ ...testUser, passwordHash: hashed })
      refreshTokenRepo.create.mockResolvedValue({})

      await service.login(loginDto, meta)

      expect(loginAttemptTracker.resetAttempts).toHaveBeenCalledWith('john@example.com')
    })

    it('throws AuthError when account is locked', async () => {
      loginAttemptTracker.isLocked.mockResolvedValue(600)

      await expect(service.login(loginDto, meta)).rejects.toThrow('temporarily locked')
      expect(userRepo.findByEmail).not.toHaveBeenCalled()
    })

    it('should throw AuthError with Google sign-in message when user has googleId but no password', async () => {
      userRepo.findByEmail.mockResolvedValue({
        ...testUser, passwordHash: null, googleId: 'google-123',
      })
      await expect(service.login(loginDto, meta)).rejects.toThrow(
        'This account uses Google sign-in',
      )
    })
  })

  // ── refresh ───────────────────────────────────────

  describe('refresh', () => {
    it('rotates token: revokes old, issues new access + refresh token', async () => {
      const crypto = await import('crypto')
      const rawToken = crypto.randomBytes(64).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

      refreshTokenRepo.findByHash.mockResolvedValue({
        id: 'rt-1',
        tokenHash,
        userId: 'user-123',
        familyId: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      })
      userRepo.findById.mockResolvedValue(testUser)
      refreshTokenRepo.revokeByHash.mockResolvedValue({})
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.refresh(rawToken, meta)

      expect(result.accessToken).toBeDefined()
      expect(result.expiresIn).toBe(900)
      expect(result.refreshToken).toBeDefined()
      expect(refreshTokenRepo.revokeByHash).toHaveBeenCalledWith(tokenHash)
      expect(refreshTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123', familyId: 'rt-1' }),
      )
    })

    it('throws AuthError for invalid token', async () => {
      refreshTokenRepo.findByHash.mockResolvedValue(null)

      await expect(service.refresh('invalid-token')).rejects.toThrow(AuthError)
    })

    it('allows revoked token within grace period (30s)', async () => {
      refreshTokenRepo.findByHash.mockResolvedValue({
        id: 'rt-grace',
        userId: 'user-123',
        familyId: 'family-1',
        revokedAt: new Date(Date.now() - 5000), // 5s ago
        expiresAt: new Date(Date.now() + 86400000),
      })
      userRepo.findById.mockResolvedValue(testUser)
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.refresh('grace-token', meta)

      expect(result.accessToken).toBeDefined()
      // Should NOT revoke family — within grace period
      expect(refreshTokenRepo.revokeByFamily).not.toHaveBeenCalled()
    })

    it('detects reuse: revokes entire family when revoked token used after grace period', async () => {
      refreshTokenRepo.findByHash.mockResolvedValue({
        id: 'rt-reused',
        userId: 'user-123',
        familyId: 'family-1',
        revokedAt: new Date(Date.now() - 60000), // 60s ago — past grace
        expiresAt: new Date(Date.now() + 86400000),
      })

      await expect(service.refresh('reused-token', meta)).rejects.toThrow('revoked')
      expect(refreshTokenRepo.revokeByFamily).toHaveBeenCalledWith('family-1')
    })

    it('throws AuthError for expired token', async () => {
      refreshTokenRepo.findByHash.mockResolvedValue({
        id: 'rt-exp',
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

  // ── updateProfile ──────────────────────────────

  describe('updateProfile', () => {
    it('should update user name and return updated user without new token', async () => {
      const updated = { ...testUser, name: 'New Name' }
      userRepo.findById.mockResolvedValue(testUser)
      userRepo.updateProfile.mockResolvedValue(updated)

      const result = await service.updateProfile('user-123', { name: 'New Name' })

      expect(userRepo.updateProfile).toHaveBeenCalledWith('user-123', { name: 'New Name' })
      expect(result.name).toBe('New Name')
      expect(result.accessToken).toBeUndefined()
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null)

      await expect(service.updateProfile('bad-id', { name: 'X' }))
        .rejects.toThrow(NotFoundError)
    })

    it('should update user name and role together and return new access token', async () => {
      userRepo.findById.mockResolvedValue(testUser)
      userRepo.updateProfile.mockResolvedValue({ ...testUser, name: 'New', role: 'ORGANIZER' })
      organizerProfileRepo.create.mockResolvedValue({})

      const result = await service.updateProfile('user-123', { name: 'New', role: 'ORGANIZER' })

      expect(result.name).toBe('New')
      expect(result.role).toBe('ORGANIZER')
      expect(result.accessToken).toBeDefined()
      expect(typeof result.accessToken).toBe('string')
    })

    it('should auto-create OrganizerProfile when role changed to ORGANIZER', async () => {
      userRepo.findById.mockResolvedValue({ ...testUser, role: 'TRAVELER' })
      userRepo.updateProfile.mockResolvedValue({ ...testUser, name: 'New', role: 'ORGANIZER' })
      organizerProfileRepo.findByUserId.mockResolvedValue(null)
      organizerProfileRepo.create.mockResolvedValue({})

      await service.updateProfile('user-123', { name: 'New', role: 'ORGANIZER' })

      expect(organizerProfileRepo.create).toHaveBeenCalledWith({
        user: { connect: { id: 'user-123' } },
        businessName: 'New',
        slug: 'new',
      })
    })

    it('should NOT create OrganizerProfile when role stays TRAVELER', async () => {
      userRepo.findById.mockResolvedValue(testUser)
      userRepo.updateProfile.mockResolvedValue({ ...testUser, name: 'New' })

      await service.updateProfile('user-123', { name: 'New' })

      expect(organizerProfileRepo.create).not.toHaveBeenCalled()
    })

    it('should NOT create OrganizerProfile if already ORGANIZER', async () => {
      const orgUser = { ...testUser, role: 'ORGANIZER' as const }
      userRepo.findById.mockResolvedValue(orgUser)
      userRepo.updateProfile.mockResolvedValue({ ...orgUser, name: 'New' })
      organizerProfileRepo.findByUserId.mockResolvedValue({ id: 'op-1' })

      const result = await service.updateProfile('user-123', { name: 'New', role: 'ORGANIZER' })

      expect(organizerProfileRepo.create).not.toHaveBeenCalled()
      expect(result.accessToken).toBeUndefined()
    })

  })

  // ── signup with defaults ────────────────────────

  describe('signup (simplified)', () => {
    it('should create user with defaults when name and role not provided', async () => {
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue({ ...testUser, name: 'User', role: 'TRAVELER' })
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.signup(
        { email: 'test@example.com', password: 'Password1' }, meta,
      )

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'User', role: 'TRAVELER' }),
      )
      expect(result.auth.user.name).toBe('User')
    })
  })

  // ── googleAuth ─────────────────────────────────

  describe('googleAuth', () => {
    const googleMeta = { userAgent: 'test-agent', ip: '127.0.0.1' }
    const googlePayload = {
      email: 'google@example.com',
      name: 'Google User',
      sub: 'google-sub-123',
      picture: 'https://photo.url/pic.jpg',
    }

    beforeEach(() => {
      vi.spyOn(service as any, 'verifyGoogleToken').mockResolvedValue(googlePayload)
    })

    it('should login existing user found by googleId', async () => {
      const existing = { ...testUser, googleId: 'google-sub-123', email: 'google@example.com' }
      userRepo.findByGoogleId.mockResolvedValue(existing)
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.googleAuth({ idToken: 'valid' }, googleMeta)

      expect(result.isNewUser).toBe(false)
      expect(result.auth.user.email).toBe('google@example.com')
      expect(userRepo.create).not.toHaveBeenCalled()
    })

    it('should link googleId when user found by email but not googleId', async () => {
      userRepo.findByGoogleId.mockResolvedValue(null)
      userRepo.findByEmail.mockResolvedValue({ ...testUser, email: 'google@example.com' })
      userRepo.updateGoogleId.mockResolvedValue({
        ...testUser, email: 'google@example.com', googleId: 'google-sub-123',
        avatarUrl: 'https://photo.url/pic.jpg',
      })
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.googleAuth({ idToken: 'valid' }, googleMeta)

      expect(userRepo.updateGoogleId).toHaveBeenCalledWith(
        'user-123', 'google-sub-123', 'https://photo.url/pic.jpg',
      )
      expect(result.auth.user.avatarUrl).toBe('https://photo.url/pic.jpg')
      expect(result.isNewUser).toBe(false)
    })

    it('should NOT overwrite existing avatar when linking Google account', async () => {
      const userWithAvatar = { ...testUser, email: 'google@example.com', avatarUrl: 'https://existing-avatar.jpg' }
      userRepo.findByGoogleId.mockResolvedValue(null)
      userRepo.findByEmail.mockResolvedValue(userWithAvatar)
      userRepo.updateGoogleId.mockResolvedValue({ ...userWithAvatar, googleId: 'google-sub-123' })
      refreshTokenRepo.create.mockResolvedValue({})

      await service.googleAuth({ idToken: 'valid' }, googleMeta)

      expect(userRepo.updateGoogleId).toHaveBeenCalledWith(
        'user-123', 'google-sub-123', undefined,
      )
    })

    it('should create new user as TRAVELER with Google name and picture', async () => {
      userRepo.findByGoogleId.mockResolvedValue(null)
      userRepo.findByEmail.mockResolvedValue(null)
      userRepo.create.mockResolvedValue({
        ...testUser, name: 'Google User', email: 'google@example.com',
        googleId: 'google-sub-123', avatarUrl: 'https://photo.url/pic.jpg',
      })
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.googleAuth({ idToken: 'valid' }, googleMeta)

      expect(userRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Google User',
        email: 'google@example.com',
        googleId: 'google-sub-123',
        role: 'TRAVELER',
        avatarUrl: 'https://photo.url/pic.jpg',
      }))
      expect(result.isNewUser).toBe(true)
    })

    it('should throw AuthError when Google token verification fails', async () => {
      vi.spyOn(service as any, 'verifyGoogleToken').mockRejectedValue(
        new AuthError('Google token verification failed'),
      )
      await expect(service.googleAuth({ idToken: 'bad' }, googleMeta)).rejects.toThrow(AuthError)
    })

    it('should throw AuthError when Google email is not verified', async () => {
      vi.spyOn(service as any, 'verifyGoogleToken').mockRejectedValue(
        new AuthError('Google email is not verified'),
      )
      await expect(service.googleAuth({ idToken: 'x' }, googleMeta))
        .rejects.toThrow('Google email is not verified')
    })

    it('should throw AuthError when existing account is deactivated (by googleId)', async () => {
      userRepo.findByGoogleId.mockResolvedValue({
        ...testUser, googleId: 'google-sub-123', isActive: false,
      })
      await expect(service.googleAuth({ idToken: 'valid' }, googleMeta))
        .rejects.toThrow('Account is deactivated')
    })

    it('should throw AuthError when existing account is deactivated (by email)', async () => {
      userRepo.findByGoogleId.mockResolvedValue(null)
      userRepo.findByEmail.mockResolvedValue({ ...testUser, isActive: false })
      await expect(service.googleAuth({ idToken: 'valid' }, googleMeta))
        .rejects.toThrow('Account is deactivated')
    })

    it('should handle P2002 race condition by retrying as login', async () => {
      userRepo.findByGoogleId.mockResolvedValueOnce(null)
      userRepo.findByEmail.mockResolvedValue(null)
      const p2002 = Object.assign(new Error('Unique'), { code: 'P2002' })
      userRepo.create.mockRejectedValue(p2002)
      userRepo.findByGoogleId.mockResolvedValueOnce({
        ...testUser, googleId: 'google-sub-123', email: 'google@example.com',
      })
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.googleAuth({ idToken: 'valid' }, googleMeta)
      expect(result.isNewUser).toBe(false)
    })

    it('should set isNewUser true for newly created Google user', async () => {
      userRepo.findByGoogleId.mockResolvedValue(null)
      userRepo.findByEmail.mockResolvedValue(null)
      userRepo.create.mockResolvedValue({
        ...testUser, name: 'Google User', email: 'google@example.com', googleId: 'google-sub-123',
      })
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.googleAuth({ idToken: 'valid' }, googleMeta)
      expect(result.isNewUser).toBe(true)
    })

    it('should use Google profile name, not default User', async () => {
      userRepo.findByGoogleId.mockResolvedValue(null)
      userRepo.findByEmail.mockResolvedValue(null)
      userRepo.create.mockResolvedValue({
        ...testUser, name: 'Google User',
      })
      refreshTokenRepo.create.mockResolvedValue({})

      const result = await service.googleAuth({ idToken: 'valid' }, googleMeta)
      expect(result.auth.user.name).toBe('Google User')
    })
  })

  // ── getFullProfile ──────────────────────────────────

  describe('getFullProfile', () => {
    const travelerWithProfile = {
      ...testUser,
      phone: '9876543210',
      phoneVerified: true,
      aadhaarVerified: false,
      createdAt: new Date('2025-01-15'),
      organizerProfile: null,
    }

    const organizerWithProfile = {
      ...travelerWithProfile,
      id: 'user-org',
      role: 'ORGANIZER' as const,
      organizerProfile: {
        id: 'org-1',
        businessName: 'Trek India Adventures',
        description: 'Best treks in India',
        verificationStatus: 'APPROVED' as const,
        rating: 4.5,
        totalReviews: 120,
        totalTripsCompleted: 45,
        bankAccountLinked: true,
        isDeleted: false,
      },
    }

    it('should return traveler profile without organizer data', async () => {
      userRepo.findWithOrganizer.mockResolvedValue(travelerWithProfile)

      const result = await service.getFullProfile('user-123')

      expect(result.id).toBe('user-123')
      expect(result.organizerProfile).toBeNull()
    })

    it('should return organizer profile with business fields', async () => {
      userRepo.findWithOrganizer.mockResolvedValue(organizerWithProfile)

      const result = await service.getFullProfile('user-org')

      expect(result.organizerProfile).not.toBeNull()
      expect(result.organizerProfile!.businessName).toBe('Trek India Adventures')
      expect(result.organizerProfile!.rating).toBe(4.5)
    })

    it('should exclude soft-deleted organizer profile', async () => {
      userRepo.findWithOrganizer.mockResolvedValue({
        ...organizerWithProfile,
        organizerProfile: { ...organizerWithProfile.organizerProfile, isDeleted: true },
      })

      const result = await service.getFullProfile('user-org')

      expect(result.organizerProfile).toBeNull()
    })

    it('should throw NotFoundError when user does not exist', async () => {
      userRepo.findWithOrganizer.mockResolvedValue(null)

      await expect(service.getFullProfile('nonexistent'))
        .rejects.toThrow(NotFoundError)
    })
  })

  // ── updateOrganizerProfile ──────────────────────────

  describe('updateOrganizerProfile', () => {
    const orgProfile = {
      id: 'org-1',
      userId: 'user-org',
      businessName: 'Trek India',
      description: 'Best treks',
      isDeleted: false,
    }

    it('should update organizer business fields', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(orgProfile)
      organizerProfileRepo.update.mockResolvedValue({
        ...orgProfile,
        businessName: 'New Business',
      })

      const result = await service.updateOrganizerProfile('user-org', {
        businessName: 'New Business',
      })

      expect(result.businessName).toBe('New Business')
      expect(organizerProfileRepo.update).toHaveBeenCalledWith('org-1', { businessName: 'New Business', slug: 'new-business' })
    })

    it('should throw NotFoundError when organizer profile does not exist', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.updateOrganizerProfile('user-1', { businessName: 'X' }),
      ).rejects.toThrow(NotFoundError)
    })

    it('should log the update event', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(orgProfile)
      organizerProfileRepo.update.mockResolvedValue(orgProfile)

      await service.updateOrganizerProfile('user-org', { description: 'New desc' })

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-org' }),
        expect.any(String),
      )
    })

    it('should pass merged documents to repo (merge logic tested in documents.test.ts)', async () => {
      const profileWithDocs = {
        ...orgProfile,
        documents: { aadhaarFront: 'https://example.com/front.jpg' },
      }
      organizerProfileRepo.findByUserId.mockResolvedValue(profileWithDocs)
      organizerProfileRepo.update.mockResolvedValue(profileWithDocs)
      docReviewRepo.upsertMany.mockResolvedValue(undefined)

      await service.updateOrganizerProfile('user-org', {
        documents: { panCard: 'https://example.com/pan.jpg' },
      })

      const updateArg = organizerProfileRepo.update.mock.calls[0][1] as { documents?: Record<string, string> }
      expect(updateArg.documents).toEqual({
        aadhaarFront: 'https://example.com/front.jpg',
        panCard: 'https://example.com/pan.jpg',
      })
    })

    it('should not include documents in update when not provided in dto', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(orgProfile)
      organizerProfileRepo.update.mockResolvedValue(orgProfile)

      await service.updateOrganizerProfile('user-org', { description: 'Updated' })

      const updateArg = organizerProfileRepo.update.mock.calls[0][1] as Record<string, unknown>
      expect(updateArg).not.toHaveProperty('documents')
    })

    it('should upsert DocumentReview rows when documents are re-uploaded', async () => {
      const profileWithDocs = {
        ...orgProfile,
        documents: { aadhaarFront: 'https://old.com/front.jpg' },
      }
      organizerProfileRepo.findByUserId.mockResolvedValue(profileWithDocs)
      organizerProfileRepo.update.mockResolvedValue(profileWithDocs)
      docReviewRepo.upsertMany.mockResolvedValue(undefined)

      await service.updateOrganizerProfile('user-org', {
        documents: { aadhaarFront: 'https://new.com/front.jpg', panCard: 'https://new.com/pan.jpg' },
      })

      expect(docReviewRepo.upsertMany).toHaveBeenCalledOnce()
      expect(docReviewRepo.upsertMany).toHaveBeenCalledWith('org-1', expect.arrayContaining([
        { docType: 'aadhaarFront', currentUrl: 'https://new.com/front.jpg' },
        { docType: 'panCard', currentUrl: 'https://new.com/pan.jpg' },
      ]))
    })

    it('should not upsert DocumentReview for doc types not in the upload', async () => {
      const profileWithDocs = { ...orgProfile, documents: {} }
      organizerProfileRepo.findByUserId.mockResolvedValue(profileWithDocs)
      organizerProfileRepo.update.mockResolvedValue(profileWithDocs)
      docReviewRepo.upsertMany.mockResolvedValue(undefined)

      await service.updateOrganizerProfile('user-org', {
        documents: { aadhaarFront: 'https://new.com/front.jpg' },
      })

      expect(docReviewRepo.upsertMany).toHaveBeenCalledOnce()
      expect(docReviewRepo.upsertMany).toHaveBeenCalledWith('org-1', [
        { docType: 'aadhaarFront', currentUrl: 'https://new.com/front.jpg' },
      ])
    })
  })

  // ── addOrganizerDocComment ──────────────────────────

  describe('addOrganizerDocComment', () => {
    const orgProfile = { id: 'org-1', userId: 'user-org' }

    it('should add a comment to the organizer doc review thread', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(orgProfile)
      docReviewRepo.addComment.mockResolvedValue({ id: 'comment_1', comment: 'Please check my Aadhaar' })

      const result = await service.addOrganizerDocComment('user-org', {
        comment: 'Please check my Aadhaar',
        docType: 'aadhaarFront',
      })

      expect(result.id).toBe('comment_1')
      expect(docReviewRepo.addComment).toHaveBeenCalledWith(expect.objectContaining({
        organizerId: 'org-1',
        authorId: 'user-org',
        authorRole: 'ORGANIZER',
        comment: 'Please check my Aadhaar',
        docType: 'aadhaarFront',
      }))
    })

    it('should throw NotFoundError when organizer profile not found', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(service.addOrganizerDocComment('user-1', { comment: 'test' }))
        .rejects.toThrow(NotFoundError)
    })
  })

  // ── getOrganizerDocComments ──────────────────────────

  describe('getOrganizerDocComments', () => {
    const orgProfile = { id: 'org-1', userId: 'user-org' }

    it('should return comments for the organizer', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(orgProfile)
      docReviewRepo.findComments.mockResolvedValue({
        data: [
          { id: 'c_1', authorId: 'admin_1', authorRole: 'ADMIN', comment: 'Re-upload front', createdAt: new Date() },
          { id: 'c_2', authorId: 'user-org', authorRole: 'ORGANIZER', comment: 'Done', createdAt: new Date() },
        ],
        total: 2,
      })

      const result = await service.getOrganizerDocComments('user-org')

      expect(result).toHaveLength(2)
      expect(result[0].comment).toBe('Re-upload front')
      expect(docReviewRepo.findComments).toHaveBeenCalledWith('org-1', { skip: 0, take: 100 })
    })

    it('should throw NotFoundError when organizer profile not found', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(null)

      await expect(service.getOrganizerDocComments('user-1'))
        .rejects.toThrow(NotFoundError)
    })

    it('should return empty array when no comments exist', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-1', userId: 'user-org' })
      docReviewRepo.findComments.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getOrganizerDocComments('user-org')

      expect(result).toEqual([])
    })
  })

  // ── updateOrganizerProfile doc review edge cases ────

  describe('updateOrganizerProfile — doc review edge cases', () => {
    const orgProfile = {
      id: 'org-1',
      userId: 'user-org',
      businessName: 'Test',
      description: 'desc',
      slug: 'test',
      documents: { aadhaarFront: 'https://old.com/front.jpg' },
    }

    it('should skip empty string doc URLs — no upsert for them', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue(orgProfile)
      organizerProfileRepo.update.mockResolvedValue(orgProfile)
      docReviewRepo.upsertMany.mockResolvedValue(undefined)

      await service.updateOrganizerProfile('user-org', {
        documents: { aadhaarFront: 'https://new.com/front.jpg', aadhaarBack: '', panCard: '' },
      })

      expect(docReviewRepo.upsertMany).toHaveBeenCalledOnce()
      expect(docReviewRepo.upsertMany).toHaveBeenCalledWith('org-1', [
        { docType: 'aadhaarFront', currentUrl: 'https://new.com/front.jpg' },
      ])
    })
  })

  // ── docReviewRepo not configured ────────────────────

  describe('doc review — repo not configured', () => {
    let serviceWithoutDocRepo: InstanceType<typeof AuthService>

    beforeEach(() => {
      serviceWithoutDocRepo = new AuthService(
        userRepo as any,
        refreshTokenRepo as any,
        organizerProfileRepo as any,
        walletRepo as any,
        JWT_SECRET,
        mockLogger,
        'test-google-client-id',
        loginAttemptTracker as any,
        null,
      )
    })

    it('addOrganizerDocComment throws when docReviewRepo is null', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-1', userId: 'user-org' })

      await expect(serviceWithoutDocRepo.addOrganizerDocComment('user-org', { comment: 'test' }))
        .rejects.toThrow('DocumentReviewRepository not configured')
    })

    it('getOrganizerDocComments throws when docReviewRepo is null', async () => {
      organizerProfileRepo.findByUserId.mockResolvedValue({ id: 'org-1', userId: 'user-org' })

      await expect(serviceWithoutDocRepo.getOrganizerDocComments('user-org'))
        .rejects.toThrow('DocumentReviewRepository not configured')
    })
  })
})
