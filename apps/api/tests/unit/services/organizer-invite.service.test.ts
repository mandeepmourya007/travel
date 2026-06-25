import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { AuthService } from '../../../src/services/auth.service'
import { AuthError, ConflictError } from '../../../src/errors/app-error'

// ── Constants ─────────────────────────────────────────

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters'
const CLIENT_URL = 'http://localhost:3000'
const ADMIN_ID = 'admin-user-1'
const ORG_EMAIL = 'organizer@example.com'
const meta = { userAgent: 'test-agent', ip: '127.0.0.1' }

// ── Mock factories ────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as import('pino').Logger

function createMockUserRepo() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByGoogleId: vi.fn(),
    create: vi.fn(),
    updatePassword: vi.fn(),
    updateProfile: vi.fn(),
    updateGoogleId: vi.fn(),
    emailExists: vi.fn().mockResolvedValue(false),
    findWithOrganizer: vi.fn(),
  }
}

function createMockRefreshTokenRepo() {
  return {
    create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
    findByHash: vi.fn(),
    revokeByHash: vi.fn(),
    revokeByFamily: vi.fn(),
    revokeAllForUser: vi.fn(),
    deleteExpired: vi.fn(),
  }
}

function createMockOrganizerProfileRepo() {
  return {
    findById: vi.fn(),
    findByUserId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'org-prof-1' }),
    update: vi.fn(),
    incrementTripCount: vi.fn(),
    slugExists: vi.fn().mockResolvedValue(false),
  }
}

function createMockWalletRepo() {
  return {
    create: vi.fn().mockResolvedValue({ id: 'wallet-1' }),
    findByUserId: vi.fn(),
  }
}

function createMockDocReviewRepo() {
  return {
    upsert: vi.fn(),
    countApproved: vi.fn(),
    findComments: vi.fn(),
    addComment: vi.fn(),
    updateAllDocStatuses: vi.fn(),
    findByOrganizerId: vi.fn(),
  }
}

function createMockInviteRepo() {
  return {
    upsert: vi.fn().mockResolvedValue({ id: 'inv-1' }),
    markAccepted: vi.fn().mockResolvedValue({ count: 1 }),
    findAll: vi.fn(),
    findByEmail: vi.fn(),
  }
}

function createMockEmailProvider() {
  return {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
    sendOtp: vi.fn().mockResolvedValue({ success: true }),
  }
}

// ── Shared user fixture ───────────────────────────────

const newOrganizerUser = {
  id: 'org-user-1',
  name: 'Alice Organizer',
  email: ORG_EMAIL,
  role: 'ORGANIZER' as const,
  isActive: true,
  avatarUrl: null,
  passwordHash: 'hashed',
  googleId: null,
  phone: null,
  phoneVerified: false,
}

// ── Test suite ────────────────────────────────────────

describe('AuthService — Organizer Invites', () => {
  let service: AuthService
  let userRepo: ReturnType<typeof createMockUserRepo>
  let refreshTokenRepo: ReturnType<typeof createMockRefreshTokenRepo>
  let organizerProfileRepo: ReturnType<typeof createMockOrganizerProfileRepo>
  let walletRepo: ReturnType<typeof createMockWalletRepo>
  let docReviewRepo: ReturnType<typeof createMockDocReviewRepo>
  let inviteRepo: ReturnType<typeof createMockInviteRepo>
  let emailProvider: ReturnType<typeof createMockEmailProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    userRepo = createMockUserRepo()
    refreshTokenRepo = createMockRefreshTokenRepo()
    organizerProfileRepo = createMockOrganizerProfileRepo()
    walletRepo = createMockWalletRepo()
    docReviewRepo = createMockDocReviewRepo()
    inviteRepo = createMockInviteRepo()
    emailProvider = createMockEmailProvider()

    service = new AuthService(
      userRepo as any,
      refreshTokenRepo as any,
      organizerProfileRepo as any,
      walletRepo as any,
      JWT_SECRET,
      mockLogger,
      undefined,
      null,
      docReviewRepo as any,
      inviteRepo as any,
      emailProvider as any,
    )
  })

  // ─────────────────────────────────────────────────────
  // createOrganizerInvite — generate link + send email
  // ─────────────────────────────────────────────────────

  describe('createOrganizerInvite', () => {
    it('returns the generated token and email', async () => {
      const result = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      expect(result.email).toBe(ORG_EMAIL)
      expect(typeof result.token).toBe('string')
      expect(result.token.length).toBeGreaterThan(20)
    })

    it('token is a valid JWT containing the email and ORGANIZER_INVITE type', async () => {
      const { token } = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>
      expect(payload.email).toBe(ORG_EMAIL)
      expect(payload.type).toBe('ORGANIZER_INVITE')
    })

    it('token expires in ~7 days', async () => {
      const { token } = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      const payload = jwt.verify(token, JWT_SECRET) as { exp: number; iat: number }
      const ttlSeconds = payload.exp - payload.iat
      // 7 days = 604800s — allow ±5s for test execution time
      expect(ttlSeconds).toBeGreaterThanOrEqual(604795)
      expect(ttlSeconds).toBeLessThanOrEqual(604805)
    })

    it('persists the invite record via upsert with email, token, and sentBy', async () => {
      const { token } = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      expect(inviteRepo.upsert).toHaveBeenCalledOnce()
      expect(inviteRepo.upsert).toHaveBeenCalledWith(ORG_EMAIL, token, ADMIN_ID)
    })

    it('sends an invite email to the organizer email address', async () => {
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      expect(emailProvider.sendEmail).toHaveBeenCalledOnce()
      const [msg] = emailProvider.sendEmail.mock.calls[0]
      expect(msg.to).toBe(ORG_EMAIL)
    })

    it('email subject mentions the app name', async () => {
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      const [msg] = emailProvider.sendEmail.mock.calls[0]
      expect(msg.subject.toLowerCase()).toContain('safarnama')
    })

    it('email HTML contains the signup URL with the generated token', async () => {
      const { token } = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      const [msg] = emailProvider.sendEmail.mock.calls[0]
      const expectedUrl = `${CLIENT_URL}/signup/organizer/${token}`
      expect(msg.html).toContain(expectedUrl)
    })

    it('email plain-text also contains the signup URL', async () => {
      const { token } = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      const [msg] = emailProvider.sendEmail.mock.calls[0]
      const expectedUrl = `${CLIENT_URL}/signup/organizer/${token}`
      expect(msg.text).toContain(expectedUrl)
    })
  })

  // ─────────────────────────────────────────────────────
  // Resend — same email, new token, email sent again
  // ─────────────────────────────────────────────────────

  describe('resend invite', () => {
    it('generates a different token on each call for the same email', async () => {
      const first = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)
      // Small delay to ensure different JWT iat
      await new Promise((r) => setTimeout(r, 1100))
      const second = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      expect(first.token).not.toBe(second.token)
    })

    it('calls upsert twice — second call overwrites the first record', async () => {
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      expect(inviteRepo.upsert).toHaveBeenCalledTimes(2)
      // Both calls target the same email
      expect(inviteRepo.upsert.mock.calls[0][0]).toBe(ORG_EMAIL)
      expect(inviteRepo.upsert.mock.calls[1][0]).toBe(ORG_EMAIL)
    })

    it('sends a new invite email on every resend call', async () => {
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      expect(emailProvider.sendEmail).toHaveBeenCalledTimes(2)
    })

    it('resend email is addressed to the same recipient', async () => {
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      const secondCall = emailProvider.sendEmail.mock.calls[1][0]
      expect(secondCall.to).toBe(ORG_EMAIL)
    })

    it('tracks which admin sent each resend', async () => {
      const ADMIN_2 = 'admin-user-2'
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)
      await service.createOrganizerInvite(ORG_EMAIL, ADMIN_2)

      expect(inviteRepo.upsert.mock.calls[0][2]).toBe(ADMIN_ID)
      expect(inviteRepo.upsert.mock.calls[1][2]).toBe(ADMIN_2)
    })
  })

  // ─────────────────────────────────────────────────────
  // verifyOrganizerInviteToken
  // ─────────────────────────────────────────────────────

  describe('verifyOrganizerInviteToken', () => {
    it('returns the email for a valid invite token', async () => {
      const { token } = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)

      const result = service.verifyOrganizerInviteToken(token)

      expect(result.email).toBe(ORG_EMAIL)
    })

    it('throws AuthError for an expired token', () => {
      const expiredToken = jwt.sign(
        { email: ORG_EMAIL, type: 'ORGANIZER_INVITE' },
        JWT_SECRET,
        { expiresIn: -1 }, // already expired
      )

      expect(() => service.verifyOrganizerInviteToken(expiredToken))
        .toThrow(AuthError)
    })

    it('throws AuthError for a token signed with a different secret', () => {
      const foreignToken = jwt.sign(
        { email: ORG_EMAIL, type: 'ORGANIZER_INVITE' },
        'wrong-secret-completely-different-key',
        { expiresIn: '7d' },
      )

      expect(() => service.verifyOrganizerInviteToken(foreignToken))
        .toThrow(AuthError)
    })

    it('throws AuthError for a token with the wrong type claim', () => {
      const accessToken = jwt.sign(
        { userId: 'u1', role: 'TRAVELER' }, // regular access token, not ORGANIZER_INVITE
        JWT_SECRET,
        { expiresIn: '7d' },
      )

      expect(() => service.verifyOrganizerInviteToken(accessToken))
        .toThrow(AuthError)
    })

    it('throws AuthError for a completely malformed string', () => {
      expect(() => service.verifyOrganizerInviteToken('not.a.jwt'))
        .toThrow(AuthError)
    })
  })

  // ─────────────────────────────────────────────────────
  // organizerSignup — accept invite
  // ─────────────────────────────────────────────────────

  describe('organizerSignup', () => {
    let validToken: string

    beforeEach(async () => {
      const result = await service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID)
      validToken = result.token
      // Reset email send count so assertions below are clean
      vi.clearAllMocks()
      // Re-apply default mock returns that clearAllMocks wiped
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(newOrganizerUser)
      organizerProfileRepo.slugExists.mockResolvedValue(false)
      organizerProfileRepo.findByUserId.mockResolvedValue(null)
      organizerProfileRepo.create.mockResolvedValue({ id: 'org-prof-1' })
      walletRepo.create.mockResolvedValue({ id: 'wallet-1' })
      refreshTokenRepo.create.mockResolvedValue({ id: 'rt-1' })
      inviteRepo.markAccepted.mockResolvedValue({ count: 1 })
    })

    it('creates the user with ORGANIZER role using the email from the token', async () => {
      await service.organizerSignup(validToken, { password: 'Password1', name: 'Alice' }, meta)

      expect(userRepo.create).toHaveBeenCalledOnce()
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: ORG_EMAIL, role: 'ORGANIZER' }),
      )
    })

    it('creates an OrganizerProfile for the new user', async () => {
      await service.organizerSignup(validToken, { password: 'Password1', name: 'Alice' }, meta)

      expect(organizerProfileRepo.create).toHaveBeenCalledOnce()
    })

    it('creates a wallet for the new user', async () => {
      await service.organizerSignup(validToken, { password: 'Password1' }, meta)

      expect(walletRepo.create).toHaveBeenCalledWith(newOrganizerUser.id)
    })

    it('marks the invite as accepted — acceptedAt timestamp gets set', async () => {
      await service.organizerSignup(validToken, { password: 'Password1' }, meta)

      expect(inviteRepo.markAccepted).toHaveBeenCalledOnce()
      expect(inviteRepo.markAccepted).toHaveBeenCalledWith(ORG_EMAIL)
    })

    it('returns valid auth tokens', async () => {
      const result = await service.organizerSignup(validToken, { password: 'Password1' }, meta)

      expect(result.auth.tokens.accessToken).toBeTruthy()
      expect(result.refreshToken).toBeTruthy()

      const payload = jwt.verify(result.auth.tokens.accessToken, JWT_SECRET) as Record<string, unknown>
      expect(payload.userId).toBe(newOrganizerUser.id)
      expect(payload.role).toBe('ORGANIZER')
    })

    it('returned auth user has ORGANIZER role', async () => {
      const result = await service.organizerSignup(validToken, { password: 'Password1' }, meta)

      expect(result.auth.user.role).toBe('ORGANIZER')
      expect(result.auth.user.email).toBe(ORG_EMAIL)
    })

    it('throws ConflictError if email is already registered', async () => {
      userRepo.emailExists.mockResolvedValue(true)

      await expect(
        service.organizerSignup(validToken, { password: 'Password1' }, meta),
      ).rejects.toThrow(ConflictError)
    })

    it('throws AuthError for an expired invite token', async () => {
      const expiredToken = jwt.sign(
        { email: ORG_EMAIL, type: 'ORGANIZER_INVITE' },
        JWT_SECRET,
        { expiresIn: -1 },
      )

      await expect(
        service.organizerSignup(expiredToken, { password: 'Password1' }, meta),
      ).rejects.toThrow(AuthError)
    })

    it('throws AuthError for a token with wrong type', async () => {
      const badToken = jwt.sign(
        { userId: 'u1', role: 'TRAVELER' },
        JWT_SECRET,
        { expiresIn: '7d' },
      )

      await expect(
        service.organizerSignup(badToken, { password: 'Password1' }, meta),
      ).rejects.toThrow(AuthError)
    })

    it('does not send an invite email on signup (only on invite generation)', async () => {
      await service.organizerSignup(validToken, { password: 'Password1' }, meta)

      // emailProvider was cleared before this test — should not be called during signup
      expect(emailProvider.sendEmail).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────
  // Graceful degradation — missing optional deps
  // ─────────────────────────────────────────────────────

  describe('when inviteRepo or emailProvider are not configured', () => {
    beforeEach(() => {
      service = new AuthService(
        userRepo as any,
        refreshTokenRepo as any,
        organizerProfileRepo as any,
        walletRepo as any,
        JWT_SECRET,
        mockLogger,
        undefined,
        null,
        docReviewRepo as any,
        null,  // no inviteRepo
        null,  // no emailProvider
      )
      userRepo.emailExists.mockResolvedValue(false)
      userRepo.create.mockResolvedValue(newOrganizerUser)
      organizerProfileRepo.slugExists.mockResolvedValue(false)
      organizerProfileRepo.create.mockResolvedValue({ id: 'org-prof-1' })
      walletRepo.create.mockResolvedValue({ id: 'wallet-1' })
      refreshTokenRepo.create.mockResolvedValue({ id: 'rt-1' })
    })

    it('createOrganizerInvite throws when emailProvider is null', async () => {
      await expect(service.createOrganizerInvite(ORG_EMAIL, ADMIN_ID))
        .rejects.toThrow('Email service is not configured')
    })

    it('organizerSignup still creates the user without inviteRepo or emailProvider', async () => {
      // createOrganizerInvite requires an email provider, so generate the token directly
      const token = jwt.sign(
        { email: ORG_EMAIL, type: 'ORGANIZER_INVITE' },
        JWT_SECRET,
        { expiresIn: '7d' },
      )

      const result = await service.organizerSignup(token, { password: 'Password1' }, meta)

      expect(result.auth.user.role).toBe('ORGANIZER')
    })
  })
})
